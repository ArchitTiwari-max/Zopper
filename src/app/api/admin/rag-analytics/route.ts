import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getRAGStatus,
  getMonthlyTrend,
  calculateRAGSummary,
  sortStoresByPriority,
  getRAGInsights,
  type RAGStorePerformance,
} from '@/lib/ragUtils';

export const runtime = 'nodejs';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRange       = searchParams.get('dateRange')    || '7days';
    const storeTypeFilter = searchParams.get('storeType')    || 'all';
    const ragFilter       = searchParams.get('ragFilter')    || 'all';
    const brandFilter     = searchParams.get('brandFilter')  || 'all';
    // Dashboard summary card mode: skip full per-store computation
    const summaryOnly     = searchParams.get('summaryOnly')  === 'true';
    // Max stores to analyze when no brand filter (prevents full-table scan on 7500+ stores)
    const storeLimit      = 10_000;

    // ── Auth check ───────────────────────────────────────────────────────────
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 401 });
    }

    // ── Real date context ────────────────────────────────────────────────────
    const now          = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    const previousMonth  = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevMonthYear  = currentMonth === 1 ? currentYear - 1 : currentYear;

    const prev2Month     = previousMonth === 1 ? 12 : previousMonth - 1;
    const prev2Year      = previousMonth === 1 ? prevMonthYear - 1 : prevMonthYear;

    const prev3Month     = prev2Month === 1 ? 12 : prev2Month - 1;
    const prev3Year      = prev2Month === 1 ? prev2Year - 1 : prev2Year;

    const monthYearPairs = [
      { month: previousMonth, year: prevMonthYear },
      { month: prev2Month,    year: prev2Year     },
      { month: prev3Month,    year: prev3Year     },
    ];

    const yearsToFetch  = Array.from(new Set([currentYear, prevMonthYear, prev2Year, prev3Year]));
    const pastYears     = yearsToFetch.filter(y => y !== currentYear);
    const sevenDaysAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── 1) Resolve brand filter ───────────────────────────────────────────────
    let brandIdFilter: string | null = null;
    if (brandFilter !== 'all') {
      const brand = await prisma.brand.findFirst({
        where: { brandName: { contains: brandFilter, mode: 'insensitive' } },
        select: { id: true }
      });
      brandIdFilter = brand?.id || null;
    }

    // ── 2) Fetch matching stores (capped to prevent full-table scan) ──────────
    const stores = await prisma.store.findMany({
      where: brandIdFilter ? { partnerBrandIds: { has: brandIdFilter } } : undefined,
      select: { id: true, storeName: true, city: true, partnerBrandTypes: true, partnerBrandIds: true },
      take: storeLimit,
    });

    const storeIds = stores.map(s => s.id);
    const CHUNK    = 500;

    // ── 3) Fetch sales in parallel chunks ────────────────────────────────────
    const storeChunks = chunk(storeIds, CHUNK);

    const [currYearNested, pastYearsNested] = await Promise.all([
      Promise.all(storeChunks.map(ids =>
        prisma.salesRecord.findMany({
          where: { storeId: { in: ids }, year: currentYear },
          select: { storeId: true, year: true, monthlySales: true, dailySales: true }
        })
      )),
      pastYears.length > 0
        ? Promise.all(storeChunks.map(ids =>
            prisma.salesRecord.findMany({
              where: { storeId: { in: ids }, year: { in: pastYears } },
              select: { storeId: true, year: true, monthlySales: true }
            })
          ))
        : Promise.resolve([] as any[])
    ]);

    const allSalesRecs = [...currYearNested.flat(), ...pastYearsNested.flat()];

    // ── 4) Build O(1) lookup maps ────────────────────────────────────────────
    type MonthData = { planSales: number; deviceSales: number; attachPct: number | null; revenue: number };
    const salesMap = new Map<string, Map<string, MonthData>>();
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
          existing.planSales   += m.planSales   || 0;
          existing.deviceSales += m.deviceSales || 0;
          existing.revenue     += m.revenue     || 0;
        }
      }
      if ((rec as any).dailySales && rec.year === currentYear && !dailyMap.has(rec.storeId)) {
        dailyMap.set(rec.storeId, (rec as any).dailySales);
      }
    }

    // ── 5) Compute RAG per store ─────────────────────────────────────────────
    const ragPerformances: RAGStorePerformance[] = [];

    for (const store of stores) {
      // Use the brand-specific type when a brand filter is active
      let storeType: string;
      if (brandIdFilter) {
        const brandIdx = store.partnerBrandIds.indexOf(brandIdFilter);
        storeType = (brandIdx >= 0 ? store.partnerBrandTypes[brandIdx] : store.partnerBrandTypes[0]) as string || 'D';
      } else {
        storeType = (store.partnerBrandTypes[0] as string) || 'D';
      }
      if (storeTypeFilter !== 'all' && storeType !== storeTypeFilter) continue;

      const storeMonths = salesMap.get(store.id);

      const currData = storeMonths?.get(`${currentYear}-${currentMonth}`);
      const prevData = storeMonths?.get(`${prevMonthYear}-${previousMonth}`);

      // 7-day plan sales from dailySales
      let currentPeriodPlanSales = 0;
      const dailySales = dailyMap.get(store.id);
      if (dailySales && typeof dailySales === 'object') {
        const monthDaily: any[] = dailySales[currentMonth.toString()] || [];
        for (const day of monthDaily) {
          const d = new Date(day.date);
          if (d >= sevenDaysAgo && d <= now) currentPeriodPlanSales += day.planSales || 0;
        }
      }
      if (currentPeriodPlanSales === 0 && currData) {
        currentPeriodPlanSales = Math.round((currData.planSales * 7) / 30);
      }

      // 3-month avg device sales
      let deviceSum3M = 0, deviceCount3M = 0;
      for (const { month, year } of monthYearPairs) {
        const d = storeMonths?.get(`${year}-${month}`);
        if (d && typeof d.deviceSales === 'number') { deviceSum3M += d.deviceSales; deviceCount3M++; }
      }
      const avgDevice3M       = deviceCount3M > 0 ? deviceSum3M / deviceCount3M : 0;
      const normalizedDevice7 = avgDevice3M > 0 ? (avgDevice3M / 30) * 7 : 0;

      const currentMonthAttachRate  = currData?.attachPct != null ? currData.attachPct * 100 : 0;
      const previousMonthAttachRate = prevData?.attachPct != null ? prevData.attachPct * 100 : 0;

      const periodAttachRate = normalizedDevice7 > 0 && currentPeriodPlanSales > 0
        ? (normalizedDevice7 / currentPeriodPlanSales) * 100 : 0;
      const currentAttachRate = periodAttachRate > 0 ? periodAttachRate : currentMonthAttachRate;

      const attachRAG       = getRAGStatus(storeType, currentAttachRate);
      const monthlyTrendRAG = getMonthlyTrend(currentMonthAttachRate, previousMonthAttachRate);

      ragPerformances.push({
        storeId:             store.id,
        storeName:           store.storeName,
        storeType,
        attachRate:          currentAttachRate,
        attachRAG,
        previousMonthAttach: previousMonthAttachRate,
        monthlyTrendRAG,
        planSales:           currentPeriodPlanSales,
        deviceSales:         Math.round(normalizedDevice7),
        city:                store.city,
        totalRevenue:        currData?.revenue || 0,
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

    return NextResponse.json({
      success: true,
      data: {
        performances: sortedPerformances,
        summary,
        insights,
        metadata: {
          dateRange,
          storeTypeFilter,
          ragFilter,
          brandFilter,
          currentMonth,
          currentYear,
          totalStoresAnalyzed: ragPerformances.length,
          filteredCount:       filteredPerformances.length
        }
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        'Vary': 'Authorization',
      }
    });

  } catch (error) {
    console.error('Error in RAG analytics API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RAG analytics data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}