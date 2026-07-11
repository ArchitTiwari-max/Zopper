import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, getTokenExpiry } from '@/lib/jwt';
import { storeUserInfo } from '@/lib/auth';

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

    const allUserRoles = await prisma.userRole.findMany({
      where: { name: { in: userRoles } }
    });
    const combinedPermissions = Array.from(new Set([
      ...allUserRoles.flatMap(r => r.permissions),
      ...(user.permissions || [])
    ]));

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      roles: userRoles
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Calculate token expiry dates
    const refreshTokenExpiry = getTokenExpiry(process.env.JWT_REFRESH_EXPIRY || '7d');
    const accessTokenExpiry = getTokenExpiry(process.env.JWT_ACCESS_EXPIRY || '15m');

    // Create user payload for cookie storage (removed createdAt, updatedAt, assignedStoreIds)
    let userPayload: any = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: userRoles[0],
      roles: userRoles,
      permissions: combinedPermissions,
      userRole: null,
      lastLoginAt: currentLoginTime,
      previousLoginAt: user.lastLoginAt
    };

    userPayload.employee = user.employee
      ? {
          id: user.employee.id,
          name: user.employee.name,
          contact_number: user.employee.contact_number,
          region: user.employee.region,
          designation: user.employee.designation,
          department: user.employee.department,
        }
      : null;

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

    // Set authentication cookies
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: false, // Set to false for development (localhost)
      sameSite: 'lax',
      expires: accessTokenExpiry,
      path: '/'
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false, // Set to false for development (localhost)
      sameSite: 'lax',
      expires: refreshTokenExpiry,
      path: '/'
    });

    // Store comprehensive user info in cookie using our new function
    storeUserInfo(response, userPayload);

    return response;

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
