import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' }, 
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Holiday ID is required' }, 
        { status: 400 }
      );
    }

    // Check if holiday exists
    const existingHoliday = await prisma.holiday.findUnique({
      where: { id },
      select: { id: true, date: true, name: true }
    });

    if (!existingHoliday) {
      return NextResponse.json(
        { error: 'Holiday not found' }, 
        { status: 404 }
      );
    }

    // Delete the holiday
    await prisma.holiday.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Holiday deleted successfully',
      deletedHoliday: {
        id: existingHoliday.id,
        date: existingHoliday.date.toISOString().split('T')[0],
        name: existingHoliday.name
      }
    });

  } catch (error) {
    console.error('Delete Holiday API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' }, 
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Holiday ID is required' }, 
        { status: 400 }
      );
    }

    // Get specific holiday
    const holiday = await prisma.holiday.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        name: true,
        description: true,
        isRecurring: true,
        createdAt: true,
        createdBy: true
      }
    });

    if (!holiday) {
      return NextResponse.json(
        { error: 'Holiday not found' }, 
        { status: 404 }
      );
    }

    // Format date for response
    const formattedHoliday = {
      ...holiday,
      date: holiday.date.toISOString().split('T')[0]
    };

    return NextResponse.json({
      holiday: formattedHoliday
    });

  } catch (error) {
    console.error('Get Holiday by ID API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}