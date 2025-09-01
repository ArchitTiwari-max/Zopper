import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Fetch executive information using userId from token
    const executive = await prisma.executive.findUnique({
      where: {
        userId: user.userId
      },
      include: {
        user: {
          select: {
            email: true,
            username: true
          }
        }
      }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Return profile data
    const profileData = {
      id: executive.id,
      name: executive.name,
      email: executive.user.email,
      username: executive.user.username,
      region: executive.region || null
    };

    return NextResponse.json({
      success: true,
      data: profileData
    }, { status: 200 });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile information' }, 
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: user.userId }
      }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
    }

    // Update user email
    const updatedUser = await prisma.user.update({
      where: {
        id: user.userId
      },
      data: {
        email
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        email: updatedUser.email
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' }, 
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
