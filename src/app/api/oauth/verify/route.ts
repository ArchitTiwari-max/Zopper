import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import { verifyToken } from '@/lib/jwt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zopvish12';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token, client_id, client_secret } = await request.json();

    if (!refresh_token || !client_id || !client_secret) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required verification parameters (refresh_token, client_id, client_secret)' },
        { status: 400 }
      );
    }

    // 1. Validate Client Credentials
    const clientApp = await prisma.client.findUnique({
      where: { clientId: client_id },
    });

    if (!clientApp || clientApp.clientSecret !== client_secret) {
      console.error(`[VERIFY-API] Client validation failed for ID: ${client_id}`);
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Client authentication failed' },
        { status: 401 }
      );
    }

    let decoded: any = null;
    let isExpired = false;

    // 2. Validate Access Token
    if (!access_token) {
      isExpired = true;
    } else {
      try {
        decoded = jwt.verify(access_token, JWT_SECRET);
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          isExpired = true;
        } else {
          console.error('[VERIFY-API] Access token verification failed:', err.message);
          return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Access token signature invalid' },
            { status: 401 }
          );
        }
      }
    }

    let finalAccessToken = access_token;
    let finalRefreshToken = refresh_token;
    let tokensRefreshed = false;
    let targetUserId = decoded ? decoded.userId : null;

    // 3. Handle Token Expiry & Rotation
    if (isExpired) {
      try {
        console.log(`[VERIFY-API] Access token expired. Attempting token rotation using refresh token...`);
        const refreshPayload = verifyToken(refresh_token);

        // Ensure token belongs to the requesting client
        if (refreshPayload.clientId !== client_id) {
          return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Token client mismatch' },
            { status: 400 }
          );
        }

        targetUserId = refreshPayload.userId;

        // Fetch user info to ensure active state
        const dbUser = await prisma.user.findUnique({
          where: { id: targetUserId },
        });

        if (!dbUser || !dbUser.isActive) {
          return NextResponse.json(
            { error: 'invalid_grant', error_description: 'User inactive or not found' },
            { status: 400 }
          );
        }

        // Generate new Access and Refresh tokens
        const tokenPayload = {
          userId: dbUser.id,
          email: dbUser.email,
          username: dbUser.username,
          roles: dbUser.roles && dbUser.roles.length > 0 ? dbUser.roles : ['EXECUTIVE'],
          clientId: client_id,
        };

        finalAccessToken = generateAccessToken(tokenPayload);
        finalRefreshToken = generateRefreshToken(tokenPayload);
        tokensRefreshed = true;
        console.log(`[VERIFY-API] Successfully rotated access/refresh tokens for user: ${dbUser.username}`);

      } catch (refreshErr: any) {
        console.error('[VERIFY-API] Refresh token rotation failed:', refreshErr.message);
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Session expired or refresh token invalid' },
          { status: 401 }
        );
      }
    }

    // 4. Fetch Complete User Profile for response
    const dbUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        employee: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'User profile not found or inactive' },
        { status: 401 }
      );
    }

    const userRoles = dbUser.roles && dbUser.roles.length > 0 ? dbUser.roles : ['EXECUTIVE'];

    // Fetch roles and permissions
    const allUserRoles = await prisma.userRole.findMany({
      where: { name: { in: userRoles } },
    });
    const combinedPermissions = Array.from(
      new Set([
        ...allUserRoles.flatMap((r) => r.permissions),
        ...(dbUser.permissions || []),
      ])
    );

    const userPayload: any = {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      role: userRoles[0],
      roles: userRoles,
      permissions: combinedPermissions,
      userRole: null,
      lastLoginAt: dbUser.lastLoginAt,
      previousLoginAt: dbUser.lastLoginAt,
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

    return NextResponse.json({
      authenticated: true,
      tokensRefreshed,
      access_token: finalAccessToken,
      refresh_token: finalRefreshToken,
      user: userPayload,
    });

  } catch (error) {
    console.error('[VERIFY-API] Error verifying session:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal verification failure' },
      { status: 500 }
    );
  }
}

/**
 * 
 * REQUEST PAYLOAD sent to POST /api/oauth/verify:
 * {
 *   "access_token": "eyJhbGciOi...",
 *   "refresh_token": "eyJhbGciOi...",
 *   "client_id": "sd_...",
 *   "client_secret": "..."
 * }
 * 
 * RESPONSE PAYLOAD returned by POST /api/oauth/verify (Status 200 OK):
 * {
 *   "authenticated": true,
 *   "tokensRefreshed": true, // true if accessToken was expired and regenerated
 *   "access_token": "eyJhbGciOi...", // fresh/rotated access token
 *   "refresh_token": "eyJhbGciOi...", // fresh/rotated refresh token
 *   "user": {
 *     "id": "user_id",
 *     "email": "user@zopper.com",
 *     "username": "username",
 *     "role": "ADMIN",
 *     "roles": ["ADMIN"],
 *     "permissions": ["MANAGE_USERS", "ACCESS_ADMIN_PORTAL", ...],
 *     "employee": { "id": "emp_id", "name": "Employee Name", ... }
 *   }
 * }
 */