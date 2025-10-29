import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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

    // Get holidays from database
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        name: true,
        description: true,
        isRecurring: true,
        createdAt: true
      }
    });

    // Format dates for frontend (YYYY-MM-DD)
    const formattedHolidays = holidays.map(holiday => ({
      ...holiday,
      date: holiday.date.toISOString().split('T')[0]
    }));

    return NextResponse.json({
      holidays: formattedHolidays
    });

  } catch (error) {
    console.error('Get Holidays API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { date, name, description, isRecurring = false } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' }, 
        { status: 400 }
      );
    }

    // Parse and validate date (expect YYYY-MM-DD format)
    const parsedDate = new Date(date + 'T00:00:00.000Z');
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' }, 
        { status: 400 }
      );
    }

    // Create holiday
    const holiday = await prisma.holiday.create({
      data: {
        date: parsedDate,
        name: name || `Holiday - ${date}`,
        description: description || null,
        isRecurring: Boolean(isRecurring),
        createdBy: user.userId
      },
      select: {
        id: true,
        date: true,
        name: true,
        description: true,
        isRecurring: true,
        createdAt: true
      }
    });

    // Format date for response
    const formattedHoliday = {
      ...holiday,
      date: holiday.date.toISOString().split('T')[0]
    };

    return NextResponse.json({
      holiday: formattedHoliday,
      message: 'Holiday created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create Holiday API Error:', error);
    
    // Handle unique constraint violation (duplicate date)
    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Holiday already exists for this date' }, 
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}