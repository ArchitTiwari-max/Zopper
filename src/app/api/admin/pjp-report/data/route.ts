import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const executiveId = searchParams.get('executiveId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const where: any = {};

    if (executiveId && executiveId !== 'All Executive') {
      where.executiveId = executiveId;
    }

    if (fromDate || toDate) {
      where.plannedVisitDate = {};
      if (fromDate) {
        where.plannedVisitDate.gte = startOfDay(new Date(fromDate));
      }
      if (toDate) {
        where.plannedVisitDate.lte = endOfDay(new Date(toDate));
      }
    }

    const visitPlans = await prisma.visitPlan.findMany({
      where,
      include: {
        executive: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        plannedVisitDate: 'desc'
      }
    });

    // Fetch store names for each plan
    // Since we have storeIds in each plan, we might need to fetch them.
    // However, if we have many plans, this could be slow.
    // Let's collect all unique store IDs first.
    const allStoreIds = Array.from(new Set(visitPlans.flatMap(p => p.storeIds)));
    const stores = await prisma.store.findMany({
      where: {
        id: { in: allStoreIds }
      },
      select: {
        id: true,
        storeName: true
      }
    });

    const storeMap = new Map(stores.map(s => [s.id, s.storeName]));

    const formattedData = visitPlans.map(plan => ({
      id: plan.id,
      executiveName: plan.executive.name,
      submittedAt: plan.submittedAt,
      plannedVisitDate: plan.plannedVisitDate,
      storeNames: plan.storeIds.map(id => storeMap.get(id) || 'Unknown Store'),
      pjpNotFollowedReason: plan.pjpNotFollowedReason || 'N/A'
    }));

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('PJP Report Data API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
