import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, getTokenExpiry } from '@/lib/jwt';
import { storeUserInfo } from '@/lib/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zopvish12';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    console.error('[SELF-SSO] Missing code parameter in OAuth callback');
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const clientId = process.env.SALESDOST_CLIENT_ID;
  const clientSecret = process.env.SALESDOST_CLIENT_SECRET;

  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const forwardedHost = rawHost.includes('0.0.0.0') ? (request.headers.get('x-forwarded-host') || '') : rawHost;
  const isLocal = forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1');
  const origin = forwardedHost ? `${isLocal ? 'http' : 'https'}://${forwardedHost}` : request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/callback/salesdost`;

  try {
    // 1. Exchange authorization code for tokens
    // Use internal loopback URL to avoid hairpin NAT / DNS issues on server
    const internalBaseUrl = `http://127.0.0.1:${process.env.PORT || '3000'}`;
    const tokenUrl = new URL('/api/oauth/token', internalBaseUrl);
    
    console.log(`[SELF-SSO] Exchanging authorization code at ${tokenUrl.toString()} for redirectUri=${redirectUri}...`);
    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error('[SELF-SSO] Token exchange failed:', tokenData);
      return NextResponse.json(
        { error: 'invalid_grant', error_description: tokenData.error_description || 'Token exchange failed' },
        { status: 400 }
      );
    }

    const { access_token, refresh_token } = tokenData;

    // 2. Decode the access token to get userId and roles
    let decoded: any;
    try {
      decoded = jwt.verify(access_token, JWT_SECRET);
    } catch (err) {
      console.error('[SELF-SSO] Access token signature verification failed:', err);
      return NextResponse.json({ error: 'invalid_token', error_description: 'Access token signature invalid' }, { status: 400 });
    }

    const userId = decoded.userId;

    // 3. Fetch user and employee data from db to build a complete user profile cookie
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: true
      }
    });

    if (!dbUser || !dbUser.isActive) {
      console.error(`[SELF-SSO] User ${userId} is inactive or not found in database.`);
      return NextResponse.json({ error: 'invalid_user', error_description: 'User not found or inactive' }, { status: 400 });
    }

    const userRoles = dbUser.roles && dbUser.roles.length > 0 ? dbUser.roles : ['EXECUTIVE'];
    const isAdmin = userRoles.includes('ADMIN');

    // Fetch role permissions to match verify-otp response
    const allUserRoles = await prisma.userRole.findMany({
      where: { name: { in: userRoles } }
    });
    const combinedPermissions = Array.from(new Set([
      ...allUserRoles.flatMap(r => r.permissions),
      ...(dbUser.permissions || [])
    ]));

    // Construct the payload matching verify-otp layout
    const currentLoginTime = new Date();
    let userPayload: any = {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      role: userRoles[0],
      roles: userRoles,
      permissions: combinedPermissions,
      userRole: null,
      lastLoginAt: currentLoginTime,
      previousLoginAt: dbUser.lastLoginAt
    };

    userPayload.employee = dbUser.employee
      ? {
          id: dbUser.employee.id,
          name: dbUser.employee.name,
          contact_number: dbUser.employee.contact_number,
          region: dbUser.employee.region,
          designation: dbUser.employee.designation,
          department: dbUser.employee.department,
        }
      : null;

    // Update lastLoginAt in background database write
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { lastLoginAt: currentLoginTime }
    });

    // 4. Redirect to appropriate dashboard (checking state for deep linking)
    const state = searchParams.get('state') || '';
    let dashboardPath = isAdmin ? '/admin/dashboard' : '/executive/dashboard';
    
    if (state.startsWith('salesdost_self_sso:')) {
      const targetPath = state.substring('salesdost_self_sso:'.length);
      // Basic security check: ensure it is a relative path starting with /
      if (targetPath && targetPath.startsWith('/') && !targetPath.startsWith('//')) {
        dashboardPath = targetPath;
      }
    }
    
    const redirectUrl = new URL(dashboardPath, request.url);
    const response = NextResponse.redirect(redirectUrl);

    // Set secure browser session cookies
    const accessTokenExpiry = getTokenExpiry(process.env.JWT_ACCESS_EXPIRY || '15m');
    const refreshTokenExpiry = getTokenExpiry(process.env.JWT_REFRESH_EXPIRY || '7d');

    response.cookies.set('accessToken', access_token, {
      httpOnly: true,
      secure: false, // development localhost
      sameSite: 'lax',
      expires: accessTokenExpiry,
      path: '/'
    });

    response.cookies.set('refreshToken', refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      expires: refreshTokenExpiry,
      path: '/'
    });

    // Store comprehensive user info in cookie (non-httpOnly for React components to read)
    storeUserInfo(response, userPayload);

    console.log(`[SELF-SSO] Loopback SSO session established for ${dbUser.username}. Redirecting to dashboard.`);
    return response;

  } catch (error) {
    console.error('[SELF-SSO] Error during loopback callback processing:', error);
    return NextResponse.json({ error: 'server_error', error_description: 'SSO callback failed' }, { status: 500 });
  }
}
