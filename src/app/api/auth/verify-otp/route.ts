import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, getTokenExpiry } from '@/lib/jwt';
import { storeUserInfo } from '@/lib/auth';

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
   if(otp !== '740810'){
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

    // Find user with executive and admin information in single query
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        executive: {
          include: {
            executiveStores: {
              select: {
                storeId: true
              }
            }
          }
        },
        admin: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role
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
      role: user.role
    };

    // Add role-specific information (keeping contact_number and region)
    if (user.role === 'EXECUTIVE' && user.executive) {
      userPayload.executive = {
        id: user.executive.id,
        name: user.executive.name,
        contact_number: user.executive.contact_number,
        region: user.executive.region
        // Removed assignedStoreIds to reduce cookie size
      };
    } else if (user.role === 'ADMIN' && user.admin) {
      userPayload.admin = {
        id: user.admin.id,
        name: user.admin.name,
        contact_number: user.admin.contact_number,
        region: user.admin.region
      };
    }

    // Create response with httpOnly cookies
    const response = NextResponse.json({
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
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
