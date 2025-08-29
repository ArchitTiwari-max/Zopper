import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const authCheck = await requireAuth(request, ['ADMIN']);
  if (authCheck.error) return authCheck.error;
  
  const user = authCheck.user;
  try {
    const { email, username, password, role } = await request.json();

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username, and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Validate role
    const userRole = role && ['ADMIN', 'EXECUTIVE'].includes(role) ? role : 'ADMIN';

    // Hash password with bcrypt
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with hashed password
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: userRole as 'ADMIN' | 'EXECUTIVE'
      }
    });

    return NextResponse.json({
      message: `${userRole} user created successfully`,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
