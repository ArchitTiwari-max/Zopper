import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  calculateAttachRate, 
  getRAGStatus, 
  getMonthlyTrend,
  calculateRAGSummary,
  sortStoresByPriority,
  getRAGInsights,
  type RAGStorePerformance
} from '@/lib/ragUtils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '7days';
    const ragFilter = searchParams.get('ragFilter') || 'all';
    const brandFilter = searchParams.get('brandFilter') || 'all';

    // For now, get the first executive ID from database (temporary solution)
    // TODO: Implement proper authentication to get real executive ID
    const executives = await prisma.executive.findMany({ take: 1 });
    
    if (!executives.length) {
      return NextResponse.json(
        { success: false, error: 'No executives found in database' },
        { status: 404 }
      );
    }

    const executiveId = executives[0].id;

    // Calculate date ranges - handle 2025 data
    const now = new Date();
    // For demo purposes, using 2025 data - in production, use actual current date
    const currentMonth = 9; // September (based on your sample data)
    const currentYear = 2025;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1; // August
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Get last 7 days for current period
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Fetch executive's assigned stores with sales data
    const executiveStoreAssignments = await prisma.executiveStoreAssignment.findMany({
      where: {
        executiveId: executiveId
      },
      include: {
        store: {
          select: {
            id: true,
            storeName: true,
            city: true,
            partnerBrandTypes: true,
            partnerBrandIds: true, // Add brand IDs for filtering
            salesRecords: {
              where: {
                year: {
                  in: [currentYear, previousYear]
                }
              },
              select: {
                year: true,
                monthlySales: true,
                dailySales: true,
              }
            }
          }
        }
      }
    });

    // Get brands for filtering (if brand filter is specified)
    let brandIdFilter: string | null = null;
    if (brandFilter !== 'all') {
      const brand = await prisma.brand.findFirst({
        where: { brandName: brandFilter }
      });
      brandIdFilter = brand?.id || null;
    }

    const ragPerformances: RAGStorePerformance[] = [];

    for (const assignment of executiveStoreAssignments) {
      const store = assignment.store;
      
      // Apply brand filter if specified
      if (brandIdFilter && !store.partnerBrandIds.includes(brandIdFilter)) {
        continue; // Skip this store if it doesn't match the brand filter
      }
      
      // Get the primary store type (first one, or default to 'D' if none)
      const storeType = store.partnerBrandTypes[0] || 'D';

      let currentPeriodPlanSales = 0;
      let currentPeriodDeviceSales = 0;
      let currentMonthPlanSales = 0;
      let currentMonthDeviceSales = 0;
      let previousMonthPlanSales = 0;
      let previousMonthDeviceSales = 0;
      let totalRevenue = 0;

      let currentMonthAttachRate = 0;
      let previousMonthAttachRate = 0;
      let currentPeriodAttachRate = 0;
      let attachRateCount = 0;
      let prevAttachRateCount = 0;

      // Process sales records
      for (const salesRecord of store.salesRecords) {
        const monthlySales = salesRecord.monthlySales as any[];
        const dailySales = salesRecord.dailySales as any;

        // Get current month data
        const currentMonthData = monthlySales.find(m => m.month === currentMonth);
        if (currentMonthData && salesRecord.year === currentYear) {
          currentMonthPlanSales += currentMonthData.planSales || 0;
          currentMonthDeviceSales += currentMonthData.deviceSales || 0;
          totalRevenue += currentMonthData.revenue || 0;
          
          // Use the existing attachPct from the database (convert decimal to percentage)
          if (currentMonthData.attachPct !== undefined && currentMonthData.attachPct !== null) {
            currentMonthAttachRate += (currentMonthData.attachPct * 100); // Convert decimal to percentage
            attachRateCount++;
          }
        }

        // Get previous month data
        const previousMonthData = monthlySales.find(m => m.month === previousMonth);
        if (previousMonthData) {
          const targetYear = previousMonth === 12 ? previousYear : currentYear;
          if (salesRecord.year === targetYear) {
            previousMonthPlanSales += previousMonthData.planSales || 0;
            previousMonthDeviceSales += previousMonthData.deviceSales || 0;
            
            // Use the existing attachPct from the database (convert decimal to percentage)
            if (previousMonthData.attachPct !== undefined && previousMonthData.attachPct !== null) {
              previousMonthAttachRate += (previousMonthData.attachPct * 100); // Convert decimal to percentage
              prevAttachRateCount++;
            }
          }
        }

        // For last 7 days, get daily sales data
        if (salesRecord.year === currentYear && dailySales && typeof dailySales === 'object') {
          const currentMonthDailySales = dailySales[currentMonth.toString()] || [];
          
          for (const dayRecord of currentMonthDailySales) {
            const recordDate = new Date(dayRecord.date);
            if (recordDate >= sevenDaysAgo && recordDate <= now) {
              currentPeriodPlanSales += dayRecord.planSales || 0;
              // Estimate device sales for daily data
              if (currentMonthData && currentMonthData.deviceSales > 0) {
                const dailyDeviceRatio = currentMonthData.deviceSales / (currentMonthDailySales.length || 1);
                currentPeriodDeviceSales += dailyDeviceRatio;
              }
            }
          }
        }
      }

      // Calculate average attach rates
      currentMonthAttachRate = attachRateCount > 0 ? currentMonthAttachRate / attachRateCount : 0;
      previousMonthAttachRate = prevAttachRateCount > 0 ? previousMonthAttachRate / prevAttachRateCount : 0;
      
      // Criteria 1: Compute attach using last 7 days plan sales and normalized 7-day device average from last 3 months
      if (currentPeriodPlanSales === 0) {
        // Fallback: approximate last 7 days plan sales from current month
        currentPeriodPlanSales = Math.round((currentMonthPlanSales * 7) / 30);
      }

      // Determine last three complete months (excluding current month)
      const prev2Month = previousMonth === 1 ? 12 : previousMonth - 1;
      const prev2Year = previousMonth === 1 ? previousYear - 1 : previousYear;
      const prev3Month = prev2Month === 1 ? 12 : prev2Month - 1;
      const prev3Year = prev2Month === 1 ? prev2Year - 1 : prev2Year;

      const monthYearPairs = [
        { month: previousMonth, year: previousMonth === 12 ? previousYear : currentYear },
        { month: prev2Month, year: prev2Year },
        { month: prev3Month, year: prev3Year },
      ];

      let deviceSum3M = 0;
      let deviceMonthsCount = 0;
      for (const salesRecord of store.salesRecords) {
        for (const { month, year } of monthYearPairs) {
          if (salesRecord.year === year) {
            const mData = (salesRecord.monthlySales as any[]).find((m: any) => m.month === month);
            if (mData && typeof mData.deviceSales === 'number') {
              deviceSum3M += mData.deviceSales;
              deviceMonthsCount++;
            }
          }
        }
      }
      const avgDevice3M = deviceMonthsCount > 0 ? deviceSum3M / deviceMonthsCount : 0;
      const normalizedDevice7 = avgDevice3M > 0 ? (avgDevice3M / 30) * 7 : 0;

      currentPeriodAttachRate = normalizedDevice7 > 0
        ? calculateAttachRate(currentPeriodPlanSales, normalizedDevice7)
        : 0;

      // Use current period attach rate as the primary metric, fallback to current month if needed
      const currentAttachRate = currentPeriodAttachRate > 0 ? currentPeriodAttachRate : currentMonthAttachRate;
      const previousAttachRate = previousMonthAttachRate;

      // Determine RAG status (no degradation penalty) and monthly trend per Criteria 2
      const attachRAG = getRAGStatus(storeType, currentAttachRate);
      const monthlyTrendRAG = getMonthlyTrend(currentMonthAttachRate, previousMonthAttachRate);

      const performance: RAGStorePerformance = {
        storeId: store.id,
        storeName: store.storeName,
        storeType: storeType,
        attachRate: currentAttachRate,
        attachRAG: attachRAG,
        previousMonthAttach: previousAttachRate,
        monthlyTrendRAG: monthlyTrendRAG,
        planSales: currentPeriodPlanSales,
        deviceSales: Math.round(((() => { 
          // reuse normalizedDevice7 if available, else 0
          try { return (avgDevice3M > 0 ? (avgDevice3M / 30) * 7 : 0); } catch { return 0; }
        })()) as number),
        city: store.city,
        totalRevenue: totalRevenue,
      };

      ragPerformances.push(performance);
    }

    // Filter by RAG status if specified
    let filteredPerformances = ragPerformances;
    if (ragFilter !== 'all') {
      const targetRAG = ragFilter.charAt(0).toUpperCase() + ragFilter.slice(1) as 'Green' | 'Amber' | 'Red';
      filteredPerformances = ragPerformances.filter(p => p.attachRAG === targetRAG);
    }

    // Sort by priority
    const sortedPerformances = sortStoresByPriority(filteredPerformances);

    // Calculate summary
    const summary = calculateRAGSummary(ragPerformances);
    
    // Get insights
    const insights = getRAGInsights(summary);

    // Additional executive-specific insights
    const executiveInsights = [
      ...insights,
      {
        type: 'info' as const,
        title: 'Your Store Coverage',
        message: `You are managing ${ragPerformances.length} store${ragPerformances.length !== 1 ? 's' : ''} across different performance levels`
      }
    ];

    if (ragPerformances.length > 0) {
      const redStores = ragPerformances.filter(p => p.attachRAG === 'Red');
      if (redStores.length > 0) {
        executiveInsights.push({
          type: 'warning' as const,
          title: 'Focus Areas',
          message: `${redStores[0].storeName} ${redStores.length > 1 ? `and ${redStores.length - 1} other store${redStores.length > 2 ? 's' : ''}` : ''} need immediate attention`,
          storeCount: redStores.length
        });
      }
    }

    // Return response
    const response = {
      success: true,
      data: {
        performances: sortedPerformances,
        summary: summary,
        insights: executiveInsights,
        metadata: {
          executiveId: executiveId,
          dateRange: dateRange,
          ragFilter: ragFilter,
          brandFilter: brandFilter,
          totalAssignedStores: ragPerformances.length,
          filteredCount: filteredPerformances.length
        }
      }
    };

    // Add caching headers (same as executive dashboard API)
    // Disable caching completely for real-time dashboard updates
    const jsonResponse = NextResponse.json(response);
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    jsonResponse.headers.set('Expires', '0');
    jsonResponse.headers.set('Vary', 'Cookie');

    return jsonResponse;

  } catch (error) {
    console.error('Error in executive RAG analytics API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch executive RAG analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
