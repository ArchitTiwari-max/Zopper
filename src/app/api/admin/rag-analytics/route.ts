import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { 
  calculateAttachRate, 
  calculateAttachRateNew,
  getRAGStatus, 
  getMonthlyTrend,
  calculateRAGSummary,
  sortStoresByPriority,
  getRAGInsights,
  formatStoreType,
  type RAGStorePerformance,
  type RAGSummary,
  type RAGInsight
} from '@/lib/ragUtils';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '7days';
    const storeTypeFilter = searchParams.get('storeType') || 'all';
    const ragFilter = searchParams.get('ragFilter') || 'all'; // 'all', 'green', 'amber', 'red'

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

    // Fetch stores with their partner brand types and sales data
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        storeName: true,
        city: true,
        partnerBrandTypes: true,
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
    });

    const ragPerformances: RAGStorePerformance[] = [];

    for (const store of stores) {
      // Get the primary store type (first one, or default to 'D' if none)
      const storeType = store.partnerBrandTypes[0] || 'D';
      
      // Skip if filtering by store type
      if (storeTypeFilter !== 'all' && storeType !== storeTypeFilter) {
        continue;
      }

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

      currentPeriodAttachRate = avgDevice3M > 0
        ? calculateAttachRateNew(currentPeriodPlanSales, avgDevice3M)
        : 0;

      // Use current period attach rate as the primary metric, fallback to current month if needed
      const currentAttachRate = currentPeriodAttachRate > 0 ? currentPeriodAttachRate : currentMonthAttachRate;
      const previousAttachRate = previousMonthAttachRate;

      // Debug logging
      if (store.storeName.includes('Samsung') || store.storeName.includes('sample')) {
        console.log(`🔍 Debug ${store.storeName}:`);
        console.log(`  Store Type: ${formatStoreType(storeType)}`);
        console.log(`  Current Attach Rate: ${currentAttachRate}% (period: ${currentPeriodAttachRate}%, monthly: ${currentMonthAttachRate}%)`);
        console.log(`  Previous Attach Rate: ${previousAttachRate}%`);
        console.log(`  Current Month Plan Sales: ${currentMonthPlanSales}, Device Sales: ${currentMonthDeviceSales}`);
        console.log(`  Attach Rate Counts: current=${attachRateCount}, prev=${prevAttachRateCount}`);
      }

      // Determine RAG status (no degradation penalty) and monthly trend per Criteria 2
      const attachRAG = getRAGStatus(storeType, currentAttachRate);
      const monthlyTrendRAG = getMonthlyTrend(currentMonthAttachRate, previousMonthAttachRate);

      // Debug logging for RAG results
      if (store.storeName.includes('Samsung') || store.storeName.includes('sample')) {
        console.log(`  Attach RAG: ${attachRAG}`);
        console.log(`  Trend Status (MoM): ${monthlyTrendRAG}`);
        console.log('---');
      }

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

    // Return response
    const response = {
      success: true,
      data: {
        performances: sortedPerformances,
        summary: summary,
        insights: insights,
        metadata: {
          dateRange: dateRange,
          storeTypeFilter: storeTypeFilter,
          ragFilter: ragFilter,
          totalStoresAnalyzed: ragPerformances.length,
          filteredCount: filteredPerformances.length
        }
      }
    };

    // Add caching headers - PRIVATE cache for admin data security (same as dashboard API)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', // 5min private cache
        'Vary': 'Authorization', // Ensure different admins get separate cache
      }
    });

  } catch (error) {
    console.error('Error in RAG analytics API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch RAG analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}