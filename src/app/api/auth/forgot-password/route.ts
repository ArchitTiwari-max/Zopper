import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendOTPEmail, generateOTP } from '@/lib/email';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Find user by username
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate OTP using your existing utility
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete any existing OTP for this email
    await prisma.oTP.deleteMany({ where: { email: user.email } });

    // Create new OTP record
    await prisma.oTP.create({
      data: {
        email: user.email,
        otp,
        expiresAt
      }
    });

    // Send OTP using your existing email utility
    const emailSent = await sendOTPEmail(user.email, otp);
    
    if (!emailSent) {
      // Clean up OTP if email failed
      await prisma.oTP.deleteMany({ where: { email: user.email } });
      return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Password reset OTP sent successfully',
      email: user.email
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
