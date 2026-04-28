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
    
    // Check if current IST time is 12:00 PM or later
    const istHours = istTime.getUTCHours();
    
    // Create Date objects for start and end of today in UTC corresponding to IST midnight
    const startOfIstToday = new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate(), -5, -30, 0, 0));
    
    let maxEvaluableDate: Date;
    if (istHours >= 12) {
      // Can evaluate today's and older PJPs
      maxEvaluableDate = new Date(startOfIstToday.getTime() + 24 * 60 * 60 * 1000); // Exclusive upper bound for today
    } else {
      // Can only evaluate yesterday's and older PJPs
      maxEvaluableDate = startOfIstToday;
    }

    // Get the MOST RECENT evaluable PJP
    const recentPlan = await prisma.visitPlan.findFirst({
      where: {
        executiveId: executive.id,
        plannedVisitDate: {
          lt: maxEvaluableDate
        }
      },
      orderBy: [
        { plannedVisitDate: 'desc' },
        { submittedAt: 'desc' }
      ]
    });

    if (!recentPlan) {
      return NextResponse.json({ hasDeviation: false });
    }

    // Determine the exact day for this recent plan to fetch visits
    const planDate = new Date(recentPlan.plannedVisitDate);
    const startOfPlanDay = new Date(Date.UTC(planDate.getUTCFullYear(), planDate.getUTCMonth(), planDate.getUTCDate(), -5, -30, 0, 0));
    const endOfPlanDay = new Date(startOfPlanDay.getTime() + 24 * 60 * 60 * 1000);

    // Get actual visits for that specific plan day
    const planVisits = await prisma.visit.findMany({
      where: {
        executiveId: executive.id,
        createdAt: {
          gte: startOfPlanDay,
          lt: endOfPlanDay
        }
      },
      select: { storeId: true }
    });

    const plannedStoreIds = new Set(recentPlan.storeIds);
    const actualStoreIds = new Set(planVisits.map(v => v.storeId));

    let hasDeviation = false;
    
    // Deviation only if a planned store was MISSED.
    // Extra unplanned visits do not count as deviation.
    for (const id of plannedStoreIds) {
      if (!actualStoreIds.has(id)) {
        hasDeviation = true;
        break;
      }
    }

    // Only ask for reason if there's a deviation AND it hasn't been filled yet
    if (hasDeviation && !recentPlan.pjpNotFollowedReason) {
      return NextResponse.json({
        hasDeviation: true,
        planId: recentPlan.id,
        pjpNotFollowedReason: ''
      });
    }

    // If reason is already filled or there is no deviation, they are clear to go
    return NextResponse.json({ hasDeviation: false });

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
