import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, getTokenExpiry } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find and verify OTP
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
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

    // Delete used OTP
    await prisma.oTP.delete({
      where: { id: otpRecord.id }
    });

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

    // Set httpOnly cookies with corrected settings for development
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

    return response;

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
