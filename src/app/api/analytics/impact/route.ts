import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

// Brand-based window rules
function getBrandWindows(brand: string) {
  // Normalize brand value
  const key = brand?.trim().toUpperCase();
  switch (key) {
    case 'A+':
      return { beforeDays: 3, afterDays: 3 };
    case 'A':
      return { beforeDays: 7, afterDays: 7 };
    case 'B':
      return { beforeDays: 10, afterDays: 10 };
    case 'C':
      return { beforeDays: 15, afterDays: 15 };
    case 'D':
      return { beforeDays: 30, afterDays: 30 };
    default:
      // Fallback: safest minimal window
      return { beforeDays: 7, afterDays: 7 };
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Math.round(n)}%`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const brand = url.searchParams.get('brand') || 'A';
    const executiveIdParam = url.searchParams.get('executiveId');
    const storeIdParam = url.searchParams.get('storeId');
    const cityParam = url.searchParams.get('city');

    const { beforeDays, afterDays } = getBrandWindows(brand);

    // Scope resolution based on role
    let scopedExecutiveId: string | undefined;
    let scopedStoreIds: string[] | undefined;

    if (user.role === 'EXECUTIVE') {
      // Resolve this executive by token
      const exec = await prisma.executive.findUnique({ where: { userId: user.userId } });
      if (!exec) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
      scopedExecutiveId = exec.id;

      // Assigned stores
      const assignments = await prisma.executiveStoreAssignment.findMany({
        where: { executiveId: exec.id },
        select: { storeId: true }
      });
      scopedStoreIds = assignments.map(a => a.storeId);

      if (storeIdParam) {
        // Further restrict if a specific store is requested (must be assigned)
        if (!scopedStoreIds.includes(storeIdParam)) {
          return NextResponse.json({ error: 'Store not assigned to this executive' }, { status: 403 });
        }
        scopedStoreIds = [storeIdParam];
      }
    } else if (user.role === 'ADMIN') {
      // Admin can filter by executiveId, storeId, city
      scopedExecutiveId = executiveIdParam || undefined;

      if (storeIdParam) {
        scopedStoreIds = [storeIdParam];
      } else if (scopedExecutiveId) {
        const assignments = await prisma.executiveStoreAssignment.findMany({
          where: { executiveId: scopedExecutiveId },
          select: { storeId: true }
        });
        scopedStoreIds = assignments.map(a => a.storeId);
      } else if (cityParam) {
        const storesInCity = await prisma.store.findMany({
          where: { city: cityParam },
          select: { id: true }
        });
        scopedStoreIds = storesInCity.map(s => s.id);
      }
    } else {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Determine stores in scope when not directly specified
    if (!scopedStoreIds) {
      const storeWhere: any = {};
      if (cityParam) storeWhere.city = cityParam;
      const stores = await prisma.store.findMany({ where: storeWhere, select: { id: true } });
      scopedStoreIds = stores.map(s => s.id);
    }

    if (!scopedStoreIds.length) {
      return NextResponse.json({ success: true, data: [], summary: { avgSalesLiftPct: 0, storesImproved: 0, storesNotImproved: 0, incentiveChangeAvgPct: 0 } });
    }

    // Fetch last visits per store in scope
    const lastVisits = await prisma.visit.findMany({
      where: {
        storeId: { in: scopedStoreIds },
        ...(scopedExecutiveId ? { executiveId: scopedExecutiveId } : {})
      },
      select: { id: true, storeId: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    // Compute most recent visit per store
    const lastVisitMap = new Map<string, Date>(); // storeId -> date
    for (const v of lastVisits) {
      if (!lastVisitMap.has(v.storeId)) lastVisitMap.set(v.storeId, v.createdAt);
    }

    // Prepare results per store
    const results: any[] = [];

    // Helper to compute date windows
    function windowsFor(lastVisit: Date) {
      const lvStart = startOfDay(lastVisit);
      const beforeStart = new Date(lvStart.getTime() - beforeDays * 24 * 60 * 60 * 1000);
      const beforeEnd = new Date(lvStart.getTime() - 1);
      const afterStart = lvStart; // include the day of visit as start of after
      const afterEnd = afterDays > 0 ? endOfDay(new Date(lvStart.getTime() + afterDays * 24 * 60 * 60 * 1000)) : null;
      return { beforeStart, beforeEnd, afterStart, afterEnd };
    }

    // Fetch stores metadata
    const storeMeta = await prisma.store.findMany({
      where: { id: { in: scopedStoreIds } },
      select: { id: true, storeName: true, city: true }
    });
    const storeNameMap = new Map(storeMeta.map(s => [s.id, { name: s.storeName, city: s.city }]));

    for (const storeId of scopedStoreIds) {
      const lastVisit = lastVisitMap.get(storeId);
      if (!lastVisit) continue; // Skip stores without any visit

      const { beforeStart, beforeEnd, afterStart, afterEnd } = windowsFor(lastVisit);

      // Sales from SalesRecord.dailySales JSON
      const salesRecords = await prisma.salesRecord.findMany({
        where: { storeId },
        select: { dailySales: true }
      });

      type Daily = { date?: string; revenue?: number; attachPct?: number; deviceSales?: number; planSales?: number };
      const allDaily: Daily[] = salesRecords.flatMap(r => Array.isArray(r.dailySales) ? (r.dailySales as any[]) : []);

      const inRange = (d: Date, s: Date, e: Date | null) => e ? d >= s && d <= e : d >= s; // when afterEnd null, only lower bound

      let salesBefore = 0;
      let salesAfter = 0;
      const salesTrendBefore: { date: string; revenue: number }[] = [];
      const salesTrendAfter: { date: string; revenue: number }[] = [];

      let attachBeforeSum = 0, attachBeforeCnt = 0;
      let attachAfterSum = 0, attachAfterCnt = 0;

      for (const day of allDaily) {
        if (!day?.date) continue;
        const d = new Date(day.date);
        const rev = Number(day.revenue || 0);
        const att = typeof day.attachPct === 'number' ? day.attachPct : undefined;

        if (d >= beforeStart && d <= beforeEnd) {
          salesBefore += rev;
          salesTrendBefore.push({ date: day.date, revenue: rev });
          if (att !== undefined) { attachBeforeSum += att; attachBeforeCnt += 1; }
        }
        if (afterDays > 0 && inRange(d, afterStart, afterEnd)) {
          salesAfter += rev;
          salesTrendAfter.push({ date: day.date, revenue: rev });
          if (att !== undefined) { attachAfterSum += att; attachAfterCnt += 1; }
        }
      }

      const attachBeforeAvg = attachBeforeCnt > 0 ? attachBeforeSum / attachBeforeCnt : 0;
      const attachAfterAvg = attachAfterCnt > 0 ? attachAfterSum / attachAfterCnt : 0;

      // Issues
      const [issuesBefore, issuesResolvedAfter, issuesPendingAfter] = await Promise.all([
        prisma.issue.count({
          where: {
            visit: { storeId },
            createdAt: { gte: beforeStart, lte: beforeEnd }
          }
        }),
        prisma.issue.count({
          where: {
            visit: { storeId },
            status: 'Resolved',
            updatedAt: afterDays > 0 ? { gte: afterStart, lte: afterEnd! } : undefined,
            ...(afterDays === 0 ? { id: 'none' } as any : {})
          }
        }),
        prisma.issue.count({
          where: {
            visit: { storeId },
            status: { in: ['Pending', 'Assigned'] },
            createdAt: afterDays > 0 ? { gte: afterStart, lte: afterEnd! } : undefined,
            ...(afterDays === 0 ? { id: 'none' } as any : {})
          }
        })
      ]);

      // Visits completed vs missed (based on VisitPlan)
      let visitsCompletedAfter = 0;
      let visitsMissedAfter = 0;
      if (afterDays > 0) {
        const [completedAfter, plans] = await Promise.all([
          prisma.visit.count({
            where: {
              storeId,
              createdAt: { gte: afterStart, lte: afterEnd! },
              ...(scopedExecutiveId ? { executiveId: scopedExecutiveId } : {})
            }
          }),
          prisma.visitPlan.findMany({
            where: {
              plannedVisitDate: { gte: afterStart, lte: afterEnd! },
              storeIds: { has: storeId },
              ...(scopedExecutiveId ? { executiveId: scopedExecutiveId } : {})
            },
            select: { id: true }
          })
        ]);
        visitsCompletedAfter = completedAfter;
        const plannedCount = plans.length;
        visitsMissedAfter = Math.max(0, plannedCount - completedAfter);
      }

      const storeInfo = storeNameMap.get(storeId) || { name: 'Unknown Store', city: 'N/A' };
      const salesImpactPct = salesBefore > 0 ? ((salesAfter - salesBefore) / salesBefore) * 100 : (salesAfter > 0 ? 100 : 0);

      results.push({
        storeId,
        store: storeInfo.name,
        city: storeInfo.city,
        brand,
        lastVisit: lastVisit.toISOString().slice(0, 10),
        salesBefore,
        salesAfter,
        salesImpact: fmtPct(salesImpactPct),
        issues: {
          raisedBefore: issuesBefore,
          resolvedAfter: afterDays > 0 ? issuesResolvedAfter : 0,
          pendingAfter: afterDays > 0 ? issuesPendingAfter : 0
        },
        incentives: {
          before: `${Math.round(attachBeforeAvg)}%`,
          after: afterDays > 0 ? `${Math.round(attachAfterAvg)}%` : 'N/A'
        },
        visits: {
          completedAfter: afterDays > 0 ? visitsCompletedAfter : 0,
          missedAfter: afterDays > 0 ? visitsMissedAfter : 0
        },
        trends: {
          salesBefore: salesTrendBefore.sort((a, b) => a.date.localeCompare(b.date)),
          salesAfter: afterDays > 0 ? salesTrendAfter.sort((a, b) => a.date.localeCompare(b.date)) : []
        }
      });
    }

    // Build summary KPIs
    const lifts = results.map(r => parseFloat(r.salesImpact.replace('%', '')));
    const avgSalesLiftPct = lifts.length ? Math.round(lifts.reduce((a, b) => a + b, 0) / lifts.length) : 0;
    const storesImproved = results.filter(r => parseFloat(r.salesImpact) > 0).length;
    const storesNotImproved = results.length - storesImproved;

    const incentChanges = results.map(r => {
      const b = typeof r.incentives.before === 'string' ? parseFloat(r.incentives.before) : 0;
      const a = typeof r.incentives.after === 'string' ? parseFloat(r.incentives.after) : 0;
      return a - b;
    });
    const incentiveChangeAvgPct = incentChanges.length ? Math.round(incentChanges.reduce((a, b) => a + b, 0) / incentChanges.length) : 0;

    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        avgSalesLiftPct,
        storesImproved,
        storesNotImproved,
        incentiveChangeAvgPct
      }
    });
  } catch (error) {
    console.error('Impact Analytics API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}