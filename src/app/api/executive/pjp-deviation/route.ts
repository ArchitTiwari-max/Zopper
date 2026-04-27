import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { id: true }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive not found' }, { status: 404 });
    }

    // Get current time in IST
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    
    // Check if current IST time is between 12:00 PM and 11:59 PM
    const istHours = istTime.getUTCHours();
    if (istHours < 12) {
      return NextResponse.json({ hasDeviation: false });
    }

    // Create Date objects for start and end of today in UTC corresponding to IST midnight
    const startOfIstToday = new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate(), -5, -30, 0, 0));
    const endOfIstToday = new Date(startOfIstToday.getTime() + 24 * 60 * 60 * 1000);

    // Get today's PJP
    const todayPlan = await prisma.visitPlan.findFirst({
      where: {
        executiveId: executive.id,
        plannedVisitDate: {
          gte: startOfIstToday,
          lt: endOfIstToday
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    if (!todayPlan) {
      return NextResponse.json({ hasDeviation: false });
    }

    // Get today's actual visits
    const todayVisits = await prisma.visit.findMany({
      where: {
        executiveId: executive.id,
        createdAt: {
          gte: startOfIstToday,
          lt: endOfIstToday
        }
      },
      select: { storeId: true }
    });

    const plannedStoreIds = new Set(todayPlan.storeIds);
    const actualStoreIds = new Set(todayVisits.map(v => v.storeId));

    let hasDeviation = false;
    
    // Deviation is if sets do not match (ignoring sequence)
    if (plannedStoreIds.size !== actualStoreIds.size) {
      hasDeviation = true;
    } else {
      for (const id of plannedStoreIds) {
        if (!actualStoreIds.has(id)) {
          hasDeviation = true;
          break;
        }
      }
    }

    return NextResponse.json({
      hasDeviation,
      planId: todayPlan.id,
      pjpNotFollowedReason: todayPlan.pjpNotFollowedReason || ''
    });

  } catch (error) {
    console.error('Error checking PJP deviation:', error);
    return NextResponse.json({ error: 'Failed to check PJP deviation' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, reason } = body;

    if (!planId || !reason) {
      return NextResponse.json({ error: 'Missing planId or reason' }, { status: 400 });
    }

    await prisma.visitPlan.update({
      where: { id: planId },
      data: { pjpNotFollowedReason: reason }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating PJP deviation reason:', error);
    return NextResponse.json({ error: 'Failed to update reason' }, { status: 500 });
  }
}
