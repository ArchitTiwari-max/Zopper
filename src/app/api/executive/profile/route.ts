import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.roles.includes('EXECUTIVE')) {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Fetch employee information using userId from token
    const employee = await prisma.employee.findUnique({
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

    if (!employee) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
    }

    // Return profile data
    const profileData = {
      id: employee.id,
      name: employee.name,
      email: employee.user.email,
      username: employee.user.username,
      contact_number: employee.contact_number || null,
      region: employee.region || null
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
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.roles.includes('EXECUTIVE')) {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, contact_number, name, region } = body;

    // At least one field must be provided
    if (!email && !contact_number && !name && !region) {
      return NextResponse.json({ error: 'At least one field is required for update' }, { status: 400 });
    }

    // Validate email format if email is provided
    if (email) {
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
    }

    // Validate contact number format if provided
    if (contact_number) {
      const phoneRegex = /^[+]?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(contact_number.replace(/[\s-()]/g, ''))) {
        return NextResponse.json({ error: 'Invalid contact number format' }, { status: 400 });
      }
    }

    // Prepare update operations
    const updates = [];

    // Update user fields (email)
    if (email) {
      const updatedUser = await prisma.user.update({
        where: { id: user.userId },
        data: { email }
      });
      updates.push({ field: 'email', value: updatedUser.email });
    }

    // Update fields (contact_number, name, region)
    const updateData: any = {};
    if (contact_number) updateData.contact_number = contact_number;
    if (name) updateData.name = name;
    if (region !== undefined) updateData.region = region;

    if (Object.keys(updateData).length > 0) {
      // 1. Update new Employee model
      await prisma.employee.update({
        where: { userId: user.userId },
        data: updateData
      });
      
      // 2. Sync legacy Executive model
      await prisma.employee.update({
        where: { userId: user.userId },
        data: updateData
      });
    }

    // Fetch updated profile data
    const employee = await prisma.employee.findUnique({
      where: { userId: user.userId },
      include: {
        user: {
          select: {
            email: true,
            username: true
          }
        }
      }
    });

    const profileData = {
      id: employee?.id,
      name: employee?.name,
      email: employee?.user.email,
      username: employee?.user.username,
      contact_number: employee?.contact_number,
      region: employee?.region
    };

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData
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
