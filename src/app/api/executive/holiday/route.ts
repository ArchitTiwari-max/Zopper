import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const body = await request.json();
    const { secNames, reason, startDate, endDate, storeId, type } = body;

    // Validate required fields
    if (!secNames || !Array.isArray(secNames) || secNames.length === 0) {
      return NextResponse.json({
        message: 'At least one SEC name is required'
      }, { status: 400 });
    }

    if (!reason || !startDate || !endDate) {
      return NextResponse.json({
        message: 'All fields are required: secNames, reason, startDate, endDate'
      }, { status: 400 });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return NextResponse.json({
        message: 'Start date cannot be after end date'
      }, { status: 400 });
    }

    // Create holiday request
    const holidayRequest = await prisma.holidayRequest.create({
      data: {
        executiveName: secNames.join(', '), // Store SEC names as comma-separated string
        reason: reason.trim(),
        startDate: start,
        endDate: end,
        userId: user.userId,
        storeId: storeId || null,
        status: 'PENDING',
        type: type === 'WEEK_OFF' ? 'WEEK_OFF' : 'VACATION',
        submittedAt: new Date()
      }
    });

    return NextResponse.json({
      message: 'Holiday request submitted successfully',
      data: {
        id: holidayRequest.id,
        secNames: holidayRequest.executiveName.split(', '), // Convert back to array for response
        reason: holidayRequest.reason,
        startDate: holidayRequest.startDate,
        endDate: holidayRequest.endDate,
        status: holidayRequest.status,
        submittedAt: holidayRequest.submittedAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating holiday request:', error);
    return NextResponse.json({
      message: 'Internal server error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get user's holiday requests
    const holidayRequests = await prisma.holidayRequest.findMany({
      where: { userId: user.userId },
      orderBy: { submittedAt: 'desc' },
      take: 20 // Limit to last 20 requests
    });

    // Manually fetch stores for the requests
    const storeIds = Array.from(new Set(holidayRequests.map(r => r.storeId).filter(Boolean))) as string[];
    let storeMap = new Map<string, string>();

    if (storeIds.length > 0) {
      const stores = await prisma.store.findMany({
        where: {
          id: { in: storeIds }
        },
        select: {
          id: true,
          storeName: true
        }
      });
      storeMap = new Map(stores.map(s => [s.id, s.storeName]));
    }

    const formattedRequests = holidayRequests.map(req => ({
      ...req,
      secNames: req.executiveName.split(', '), // Convert back to array for frontend consistency if needed
      storeName: req.storeId ? storeMap.get(req.storeId) || 'Unknown Store' : 'N/A',
      type: req.type || 'VACATION'
    }));

    return NextResponse.json({
      message: 'Holiday requests retrieved successfully',
      data: formattedRequests
    });

  } catch (error) {
    console.error('Error fetching holiday requests:', error);
    return NextResponse.json({
      message: 'Internal server error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}