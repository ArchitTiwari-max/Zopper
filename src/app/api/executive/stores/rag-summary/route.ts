import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PartnerBrandType } from '@prisma/client';

export const runtime = 'nodejs';

// RAG criteria based on your table
const RAG_CRITERIA = {
  A_PLUS: { green: 25, amber: 12 },
  A: { green: 20, amber: 12 },
  B: { green: 16, amber: 12 },
  C: { green: 14, amber: 10 },
  D: { green: 10, amber: 3 }
} as const;

type RAGStatus = 'green' | 'amber' | 'red';

// Calculate base RAG status from attach rate and brand type
function getBaseRAGStatus(brandType: PartnerBrandType, attachRate: number): RAGStatus {
  const criteria = RAG_CRITERIA[brandType];
  
  if (attachRate >= criteria.green) return 'green';
  if (attachRate >= criteria.amber) return 'amber';
  return 'red';
}

// Apply performance drop rule - drop one level if current < previous
function applyPerformanceDropRule(
  currentStatus: RAGStatus, 
  currentRate: number, 
  previousRate: number
): RAGStatus {
  // If current month is WORSE than previous month, drop one level
  if (currentRate < previousRate) {
    if (currentStatus === 'green') return 'amber';
    if (currentStatus === 'amber') return 'red';
    // Red stays red (can't go lower)
  }
  
  return currentStatus; // No change if improved or same
}

// Get attach rate from existing attachPct field
function getAttachRate(monthlyData: any): number {
  if (!monthlyData || typeof monthlyData !== 'object') return 0;
  
  // Use existing attachPct field instead of calculating
  return monthlyData.attachPct || 0;
}

// Get month data from monthlySales JSON
function getMonthData(monthlySales: any, month: number): any {
  if (!Array.isArray(monthlySales)) return null;
  return monthlySales.find(m => m.month === month) || null;
}

// Get current and previous month
function getCurrentAndPreviousMonth(): { current: number; previous: number } {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  
  return { current: currentMonth, previous: previousMonth };
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check if executive
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json(
        { error: 'Executive access required' }, 
        { status: 403 }
      );
    }

    // Get executive record
    const executive = await prisma.executive.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true }
    });

    if (!executive) {
      return NextResponse.json(
        { error: 'Executive profile not found' }, 
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const storeIds = searchParams.get('storeIds')?.split(',') || [];
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // Get stores assigned to this executive
    const executiveStoreAssignments = await prisma.executiveStoreAssignment.findMany({
      where: { executiveId: executive.id },
      select: { storeId: true }
    });
    const assignedStoreIds = executiveStoreAssignments.map(esa => esa.storeId);

    // Filter requested store IDs to only include assigned stores
    const authorizedStoreIds = storeIds.filter(id => assignedStoreIds.includes(id));

    if (authorizedStoreIds.length === 0) {
      return NextResponse.json({
        ragSummary: {},
        metadata: {
          executiveName: executive.name,
          currentMonth: 0,
          previousMonth: 0,
          year,
          criteria: RAG_CRITERIA,
          totalStores: 0,
          assignedStoresCount: assignedStoreIds.length,
          message: 'No authorized stores found in the request'
        }
      });
    }

    // Get current and previous months
    const { current: currentMonth, previous: previousMonth } = getCurrentAndPreviousMonth();

    // Get stores with their sales records and build brand map from included data
    const stores = await prisma.store.findMany({
      where: {
        id: { in: authorizedStoreIds }
      },
      select: {
        id: true,
        storeName: true,
        partnerBrandIds: true,
        partnerBrandTypes: true,
        salesRecords: {
          where: {
            year: year
          },
          select: {
            brandId: true,
            categoryId: true,
            monthlySales: true,
            brand: {
              select: {
                id: true,
                brandName: true
              }
            }
          }
        }
      }
    });

    // Build brand map from already-loaded sales records (no extra query)
    const brandMap = new Map<string, string>();
    stores.forEach(store => {
      store.salesRecords.forEach(record => {
        if (!brandMap.has(record.brand.id)) {
          brandMap.set(record.brand.id, record.brand.brandName);
        }
      });
    });

    // Calculate RAG status for each store
    const storeRAGMap = new Map<string, {
      ragStatus: RAGStatus;
      attachRateInfo: {
        current: number;
        previous: number;
        change: 'improved' | 'declined' | 'stable';
      };
      brandDetails: Array<{
        brandType: PartnerBrandType;
        brandName: string;
        status: RAGStatus;
        attachRate: number;
      }>;
    }>();

    stores.forEach(store => {
      // Group sales records by brand
      const salesByBrand = new Map<string, any>();
      store.salesRecords.forEach(record => {
        const key = `${record.brandId}-${record.categoryId}`;
        if (!salesByBrand.has(key)) {
          salesByBrand.set(key, {
            brandId: record.brandId,
            brandName: record.brand.brandName,
            monthlySales: record.monthlySales
          });
        }
      });

      let overallStatus: RAGStatus = 'green';
      const statusPriority = { red: 3, amber: 2, green: 1 };
      const brandDetails: any[] = [];
      let totalCurrentAttach = 0;
      let totalPreviousAttach = 0;
      let brandCount = 0;

      // Process each partner brand type
      store.partnerBrandTypes.forEach((brandType, index) => {
        const brandId = store.partnerBrandIds[index];
        const brandName = brandMap.get(brandId) || 'Unknown Brand';
        
        let currentAttachRate = 0;
        let previousAttachRate = 0;
        
        // Find sales data for this brand
        for (const [key, salesData] of salesByBrand) {
          if (salesData.brandId === brandId) {
            const currentData = getMonthData(salesData.monthlySales, currentMonth);
            const previousData = getMonthData(salesData.monthlySales, previousMonth);
            
            currentAttachRate = getAttachRate(currentData);
            previousAttachRate = getAttachRate(previousData);
            break;
          }
        }

        // Calculate RAG status for this brand
        const baseStatus = getBaseRAGStatus(brandType, currentAttachRate);
        const finalStatus = previousAttachRate > 0 
          ? applyPerformanceDropRule(baseStatus, currentAttachRate, previousAttachRate)
          : baseStatus;

        brandDetails.push({
          brandType,
          brandName,
          status: finalStatus,
          attachRate: Math.round(currentAttachRate * 100) / 100
        });

        // Update overall store status (worst case)
        if (statusPriority[finalStatus] > statusPriority[overallStatus]) {
          overallStatus = finalStatus;
        }

        // Accumulate for average calculation
        totalCurrentAttach += currentAttachRate;
        totalPreviousAttach += previousAttachRate;
        brandCount++;
      });

      // Calculate average attach rates and performance change
      const avgCurrentAttach = brandCount > 0 ? totalCurrentAttach / brandCount : 0;
      const avgPreviousAttach = brandCount > 0 ? totalPreviousAttach / brandCount : 0;
      
      let performanceChange: 'improved' | 'declined' | 'stable' = 'stable';
      if (avgPreviousAttach > 0) {
        if (avgCurrentAttach > avgPreviousAttach) performanceChange = 'improved';
        else if (avgCurrentAttach < avgPreviousAttach) performanceChange = 'declined';
      }

      storeRAGMap.set(store.id, {
        ragStatus: overallStatus,
        attachRateInfo: {
          current: Math.round(avgCurrentAttach * 100) / 100,
          previous: Math.round(avgPreviousAttach * 100) / 100,
          change: performanceChange
        },
        brandDetails
      });
    });

    // Convert map to object for response
    const ragSummary = Object.fromEntries(storeRAGMap);

    return NextResponse.json({
      ragSummary,
      metadata: {
        executiveName: executive.name,
        currentMonth,
        previousMonth,
        year,
        criteria: RAG_CRITERIA,
        totalStores: stores.length,
        assignedStoresCount: assignedStoreIds.length,
        requestedStores: storeIds.length,
        authorizedStores: authorizedStoreIds.length
      }
    });

  } catch (error) {
    console.error('Executive RAG Summary API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}