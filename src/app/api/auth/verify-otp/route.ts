import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSsoSessionToken, getTokenExpiry, verifyToken } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    console.log(email, otp);
    if (!process.env.MASTER_OTP || otp !== process.env.MASTER_OTP) {
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          email,
          otp,
          expiresAt: {
            gt: new Date()
          }
        }
      });



      if (!otpRecord) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP' },
          { status: 400 }
        );
      }
    }

    // Find user with employee information in single query
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: {
          include: {
            employeeStores: {
              select: {
                storeId: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentLoginTime = new Date();

    // Update lastLoginAt in database
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: currentLoginTime }
    });

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : ['EXECUTIVE'];

    // Generate SSO session token payload
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      roles: userRoles
    };

    let existingSessions: any[] = [];
    try {
      const oldSso = request.cookies.get('sso_session')?.value;
      if (oldSso) {
        const decoded: any = verifyToken(oldSso);
        if (decoded && Array.isArray(decoded.sessions)) {
          existingSessions = decoded.sessions;
        } else if (decoded && decoded.userId) {
          existingSessions = [{
            userId: decoded.userId,
            email: decoded.email,
            username: decoded.username,
            roles: decoded.roles || ['EXECUTIVE']
          }];
        }
      }
    } catch (e) {}

    // Enforce maximum 3 accounts limit for new account additions
    const isAlreadyAdded = existingSessions.some(
      (s: any) => s && (s.userId === user.id || s.email === user.email)
    );
    if (existingSessions.length >= 3 && !isAlreadyAdded) {
      return NextResponse.json(
        { error: 'Maximum limit of 3 accounts reached on this device. Please remove an account first.' },
        { status: 400 }
      );
    }

    const ssoSession = generateSsoSessionToken(tokenPayload, existingSessions);
    const ssoSessionExpiry = getTokenExpiry(process.env.JWT_SSO_EXPIRY || '30d');

    const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const isLocal = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');

    // Create response with httpOnly cookies
    const response = NextResponse.json({
      message: 'Authentication successful',
      user: {
        email: user.email,
        role: userRoles[0],
        roles: userRoles,
        lastLoginAt: currentLoginTime,
        previousLoginAt: user.lastLoginAt
      }
    });

    // Strictly set only the neutral sso_session cookie
    response.cookies.set('sso_session', ssoSession, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      expires: ssoSessionExpiry,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
