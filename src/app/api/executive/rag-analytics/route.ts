import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getRAGStatus,
  getMonthlyTrend,
  calculateRAGSummary,
  sortStoresByPriority,
  getRAGInsights,
  type RAGStorePerformance
} from '@/lib/ragUtils';

export const runtime = 'nodejs';

// Chunk a large array into batches
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ragFilter    = searchParams.get('ragFilter')    || 'all';
    const brandFilter  = searchParams.get('brandFilter')  || 'all';
    const dateRange    = searchParams.get('dateRange')    || '7days';

    // ── Auth ────────────────────────────────────────────────────────────────────
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser || authenticatedUser.role !== 'EXECUTIVE') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Executive access required' },
        { status: 401 }
      );
    }

    const executive = await prisma.executive.findUnique({
      where: { userId: authenticatedUser.userId },
      select: { id: true }
    });
    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }
    const executiveId = executive.id;

    // ── Date context: use latest available month in DB ───────────────────────
    // Determine the most recent month that has data (avoids hardcoded dates)
    const now          = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const prev2Month    = previousMonth === 1 ? 12 : previousMonth - 1;
    const prev2Year     = previousMonth === 1 ? prevMonthYear - 1 : prevMonthYear;

    const prev3Month    = prev2Month === 1 ? 12 : prev2Month - 1;
    const prev3Year     = prev2Month === 1 ? prev2Year - 1 : prev2Year;

    const yearsToFetch  = Array.from(new Set([currentYear, prevMonthYear, prev2Year, prev3Year]));
    const pastYears     = yearsToFetch.filter(y => y !== currentYear);

    const monthYearPairs = [
      { month: previousMonth, year: prevMonthYear },
      { month: prev2Month,    year: prev2Year     },
      { month: prev3Month,    year: prev3Year     },
    ];

    const sevenDaysAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── 1) Resolve brand filter ID (if needed) ───────────────────────────────
    let brandIdFilter: string | null = null;
    if (brandFilter !== 'all') {
      const brand = await prisma.brand.findFirst({
        where: { brandName: brandFilter },
        select: { id: true }
      });
      brandIdFilter = brand?.id || null;
    }

    // ── 2) Get executive's assigned store IDs ────────────────────────────────
    const assignments = await prisma.executiveStoreAssignment.findMany({
      where: { executiveId },
      select: { storeId: true }
    });
    if (assignments.length === 0) {
      return NextResponse.json({
        success: true,
        data: { performances: [], summary: { total: 0, green: 0, amber: 0, red: 0, greenPct: 0, amberPct: 0, redPct: 0, avgAttachRate: 0 }, insights: [], metadata: { executiveId, dateRange, ragFilter, brandFilter, totalAssignedStores: 0, filteredCount: 0 } }
      });
    }

    const allStoreIds = assignments.map(a => a.storeId);
    const CHUNK       = 500;

    // ── 3) Fetch stores + sales records IN PARALLEL ──────────────────────────
    const storeChunks = chunk(allStoreIds, CHUNK);

    const [storesNested, currYearNested, pastYearsNested] = await Promise.all([
      // Fetch store metadata
      Promise.all(storeChunks.map(ids =>
        prisma.store.findMany({
          where: { id: { in: ids } },
          select: { id: true, storeName: true, city: true, partnerBrandTypes: true, partnerBrandIds: true }
        })
      )),
      // Fetch current year sales (with dailySales)
      Promise.all(storeChunks.map(ids =>
        prisma.salesRecord.findMany({
          where: { storeId: { in: ids }, year: currentYear },
          select: { storeId: true, year: true, monthlySales: true, dailySales: true }
        })
      )),
      // Fetch past years sales (skip dailySales to cut payload)
      pastYears.length > 0
        ? Promise.all(storeChunks.map(ids =>
            prisma.salesRecord.findMany({
              where: { storeId: { in: ids }, year: { in: pastYears } },
              select: { storeId: true, year: true, monthlySales: true }
            })
          ))
        : Promise.resolve([] as any[])
    ]);

    const allStores      = storesNested.flat();
    const allSalesRecs   = [...currYearNested.flat(), ...pastYearsNested.flat()];

    // ── 4) Build O(1) lookup maps ────────────────────────────────────────────
    // storeId -> month -> { planSales, deviceSales, attachPct, revenue }
    type MonthData = { planSales: number; deviceSales: number; attachPct: number | null; revenue: number };
    const salesMap = new Map<string, Map<string, MonthData>>();
    // storeId -> dailySales object (current year only)
    const dailyMap = new Map<string, any>();

    for (const rec of allSalesRecs) {
      if (!salesMap.has(rec.storeId)) salesMap.set(rec.storeId, new Map());
      const storeMonths = salesMap.get(rec.storeId)!;
      for (const m of (rec.monthlySales as any[])) {
        const key = `${rec.year}-${m.month}`;
        const existing = storeMonths.get(key);
        if (!existing) {
          storeMonths.set(key, {
            planSales:   m.planSales   || 0,
            deviceSales: m.deviceSales || 0,
            attachPct:   m.attachPct   ?? null,
            revenue:     m.revenue     || 0,
          });
        } else {
          // Aggregate if multiple records per (store, year, month)
          existing.planSales   += m.planSales   || 0;
          existing.deviceSales += m.deviceSales || 0;
          existing.revenue     += m.revenue     || 0;
        }
      }
      // Keep dailySales only for current year
      if ((rec as any).dailySales && rec.year === currentYear && !dailyMap.has(rec.storeId)) {
        dailyMap.set(rec.storeId, (rec as any).dailySales);
      }
    }

    // ── 5) Compute RAG for each store (pure in-memory, O(1) lookups) ─────────
    const ragPerformances: RAGStorePerformance[] = [];

    for (const store of allStores) {
      // Brand filter
      if (brandIdFilter && !store.partnerBrandIds.includes(brandIdFilter)) continue;

      // Use the brand-specific type when a brand filter is active, 
      // or pick the "best" type among all brands if no filter is applied.
      let storeType: string;
      if (brandIdFilter) {
        const brandIdx = store.partnerBrandIds.indexOf(brandIdFilter);
        storeType = (brandIdx >= 0 ? store.partnerBrandTypes[brandIdx] : store.partnerBrandTypes[0]) as string || 'D';
      } else {
        // Find the "highest" type (A+ > A > B > C > D)
        const priorityOrder: Record<string, number> = { 'A_PLUS': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
        let bestType = 'D';
        let bestScore = 0;
        
        for (const t of store.partnerBrandTypes) {
          const score = priorityOrder[t as string] || 0;
          if (score > bestScore) {
            bestScore = score;
            bestType = t as string;
          }
        }
        storeType = bestType;
      }
      const storeMonths = salesMap.get(store.id);

      // Current month data
      const currKey   = `${currentYear}-${currentMonth}`;
      const currData  = storeMonths?.get(currKey);

      // Previous month data
      const prevKey   = `${prevMonthYear}-${previousMonth}`;
      const prevData  = storeMonths?.get(prevKey);

      // ── 7-day plan sales from dailySales ──────────────────────────────────
      let currentPeriodPlanSales = 0;
      const dailySales = dailyMap.get(store.id);
      if (dailySales && typeof dailySales === 'object') {
        const monthDaily: any[] = dailySales[currentMonth.toString()] || [];
        for (const day of monthDaily) {
          const d = new Date(day.date);
          if (d >= sevenDaysAgo && d <= now) {
            currentPeriodPlanSales += day.planSales || 0;
          }
        }
      }
      // Fallback: estimate 7 days from monthly
      if (currentPeriodPlanSales === 0 && currData) {
        currentPeriodPlanSales = Math.round((currData.planSales * 7) / 30);
      }

      // ── 3-month avg device sales ───────────────────────────────────────────
      let deviceSum3M   = 0;
      let deviceCount3M = 0;
      for (const { month, year } of monthYearPairs) {
        const d = storeMonths?.get(`${year}-${month}`);
        if (d && typeof d.deviceSales === 'number') {
          deviceSum3M   += d.deviceSales;
          deviceCount3M++;
        }
      }
      const avgDevice3M      = deviceCount3M > 0 ? deviceSum3M / deviceCount3M : 0;
      const normalizedDevice7 = avgDevice3M > 0 ? (avgDevice3M / 30) * 7 : 0;

      // ── Attach rates ───────────────────────────────────────────────────────
      const currentMonthAttachRate  = currData?.attachPct != null ? currData.attachPct * 100 : 0;
      const previousMonthAttachRate = prevData?.attachPct != null ? prevData.attachPct * 100 : 0;

      const periodAttachRate = normalizedDevice7 > 0 && currentPeriodPlanSales > 0
        ? (normalizedDevice7 / currentPeriodPlanSales) * 100
        : 0;

      const currentAttachRate = periodAttachRate > 0 ? periodAttachRate : currentMonthAttachRate;

      const attachRAG      = getRAGStatus(storeType, currentAttachRate);
      const monthlyTrendRAG = getMonthlyTrend(currentMonthAttachRate, previousMonthAttachRate);

      ragPerformances.push({
        storeId:            store.id,
        storeName:          store.storeName,
        storeType,
        attachRate:         currentAttachRate,
        attachRAG,
        previousMonthAttach: previousMonthAttachRate,
        monthlyTrendRAG,
        planSales:          currentPeriodPlanSales,
        deviceSales:        Math.round(normalizedDevice7),
        city:               store.city,
        totalRevenue:       currData?.revenue || 0,
      });
    }

    // ── 6) Filter + sort + summarize ─────────────────────────────────────────
    let filteredPerformances = ragPerformances;
    if (ragFilter !== 'all') {
      const targetRAG = (ragFilter.charAt(0).toUpperCase() + ragFilter.slice(1)) as 'Green' | 'Amber' | 'Red';
      filteredPerformances = ragPerformances.filter(p => p.attachRAG === targetRAG);
    }

    const sortedPerformances = sortStoresByPriority(filteredPerformances);
    const summary            = calculateRAGSummary(ragPerformances);
    const insights           = getRAGInsights(summary);

    const executiveInsights = [
      ...insights,
      { type: 'info' as const, title: 'Your Store Coverage', message: `You are managing ${ragPerformances.length} store${ragPerformances.length !== 1 ? 's' : ''} across different performance levels` }
    ];

    const redStores = ragPerformances.filter(p => p.attachRAG === 'Red');
    if (redStores.length > 0) {
      executiveInsights.push({
        type:       'warning' as const,
        title:      'Focus Areas',
        message:    `${redStores[0].storeName} ${redStores.length > 1 ? `and ${redStores.length - 1} other store${redStores.length > 2 ? 's' : ''}` : ''} need immediate attention`,
        storeCount: redStores.length
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        performances: sortedPerformances,
        summary,
        insights: executiveInsights,
        metadata: {
          executiveId,
          dateRange,
          ragFilter,
          brandFilter,
          currentMonth,
          currentYear,
          totalAssignedStores: ragPerformances.length,
          filteredCount:       filteredPerformances.length
        }
      }
    }, {
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Vary': 'Cookie'
      }
    });

  } catch (error) {
    console.error('Error in executive RAG analytics API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch executive RAG analytics data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
