import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOTP, sendOTPEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  
  console.log(`[SIGNIN-API] ${timestamp} - Sign-in attempt from IP: ${ipAddress}`);
  
  try {
    const { username, password } = await request.json();
    
    console.log(`[SIGNIN-API] ${timestamp} - Processing sign-in for username: ${username}`);

    if (!username || !password) {
      console.log(`[SIGNIN-ERROR] ${timestamp} - Missing credentials for username: ${username}`);
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user by username
    console.log(`[SIGNIN-API] ${timestamp} - Looking up user: ${username}`);
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      console.log(`[SIGNIN-ERROR] ${timestamp} - User not found: ${username}`);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }
    
    console.log(`[SIGNIN-API] ${timestamp} - User found: ${username}, Role: ${user.role}, Email: ${user.email}`);

    // Verify password using bcrypt
    console.log(`[SIGNIN-API] ${timestamp} - Verifying password for user: ${username}`);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`[SIGNIN-ERROR] ${timestamp} - Invalid password for user: ${username}`);
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }
    
    console.log(`[SIGNIN-API] ${timestamp} - Password verified for user: ${username}`);
    
    // Use the user's email from database for OTP
    const email = user.email;
    console.log(`[SIGNIN-API] ${timestamp} - Generating OTP for email: ${email}`);
    
    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    console.log(`[SIGNIN-API] ${timestamp} - OTP generated for ${email}, expires at: ${expiresAt.toISOString()}`);
    // Delete existing OTPs for this email
    await prisma.oTP.deleteMany({
      where: { email }
    });

    // Store OTP in database
    await prisma.oTP.create({
      data: {
        email,
        otp,
        expiresAt
      }
    });
    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send OTP email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'OTP sent successfully',
      email: email
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
