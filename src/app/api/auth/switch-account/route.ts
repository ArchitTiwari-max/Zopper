import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, generateSsoSessionToken, getTokenExpiry, verifyToken } from '@/lib/jwt';
import { storeUserInfo } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify user is in sso_session cookie
    const ssoCookie = request.cookies.get('sso_session')?.value;
    let existingSessions: any[] = [];
    let isKnownAccount = false;

    if (ssoCookie) {
      try {
        const decoded: any = verifyToken(ssoCookie);
        if (decoded && Array.isArray(decoded.sessions)) {
          existingSessions = decoded.sessions;
          isKnownAccount = existingSessions.some((s: any) => s.userId === userId);
        }
        if (decoded && (decoded.activeUserId === userId || decoded.userId === userId)) {
          isKnownAccount = true;
        }
      } catch (e) {
        console.error('Error verifying ssoCookie in switch-account:', e);
      }
    }

    // Also check userInfo cookie fallback if sso_session wasn't multi-account yet
    if (!isKnownAccount) {
      try {
        const rawUserInfo = request.cookies.get('userInfo')?.value;
        if (rawUserInfo) {
          const u = JSON.parse(rawUserInfo);
          if (u && (u.id === userId || u.userId === userId)) isKnownAccount = true;
        }
      } catch (e) {}
    }

    if (!isKnownAccount) {
      return NextResponse.json({ error: 'Account not found in session list. Please login again.' }, { status: 403 });
    }

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Account is disabled or no longer exists' }, { status: 403 });
    }

    const currentLoginTime = new Date().toISOString();
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : ['EXECUTIVE'];

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      roles: userRoles
    };

    const ssoSession = generateSsoSessionToken(tokenPayload, existingSessions);
    const ssoSessionExpiry = getTokenExpiry(process.env.JWT_SSO_EXPIRY || '30d');

    const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const isLocal = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');

    let userPayload: any = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: userRoles[0],
      roles: userRoles,
      permissions: user.permissions || [],
      userRole: null,
      lastLoginAt: currentLoginTime,
      previousLoginAt: user.lastLoginAt
    };

    if (user.employee) {
      userPayload.employee = {
        id: user.employee.id,
        name: user.employee.name,
        contact_number: user.employee.contact_number,
        region: user.employee.region,
        designation: user.employee.designation,
        department: user.employee.department,
      };
    }

    const response = NextResponse.json({
      message: 'Account switched successfully',
      user: userPayload
    });

    response.cookies.set('sso_session', ssoSession, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      expires: ssoSessionExpiry,
      path: '/'
    });

    storeUserInfo(response, userPayload);

    return response;
  } catch (error) {
    console.error('Switch account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
