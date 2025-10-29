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
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' }, 
        { status: 403 }
      );
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const partnerBrand = searchParams.get('partnerBrand');
    const ragFilter = searchParams.get('ragStatus'); // 'green', 'amber', 'red', or 'all'
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // Build where clause for stores
    let whereClause: any = {};
    
    if (city && city !== 'All City') {
      whereClause.city = city;
    }

    // Get current and previous months
    const { current: currentMonth, previous: previousMonth } = getCurrentAndPreviousMonth();

    // Get stores with their sales records and brand information
    const stores = await prisma.store.findMany({
      where: whereClause,
      include: {
        salesRecords: {
          where: {
            year: year
          },
          include: {
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

    // Get brand lookup for partner brand filtering
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        brandName: true
      }
    });
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Process stores and calculate RAG status
    const processedStores = stores.map(store => {
      // Get partner brands for this store
      const partnerBrands = store.partnerBrandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean) as string[];

      // Apply brand filter if specified
      if (partnerBrand && partnerBrand !== 'All Brands') {
        if (!partnerBrands.includes(partnerBrand)) {
          return null; // Filter out this store
        }
      }

      // Calculate RAG status for each partner brand type
      const brandRAGStatuses: Array<{
        brandType: PartnerBrandType;
        brandName: string;
        currentAttachRate: number;
        previousAttachRate: number;
        baseStatus: RAGStatus;
        finalStatus: RAGStatus;
        performanceChange: 'improved' | 'declined' | 'stable';
      }> = [];

      // Group sales records by brand and calculate attach rates
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

      // Process each partner brand type
      store.partnerBrandTypes.forEach((brandType, index) => {
        const brandId = store.partnerBrandIds[index];
        const brandName = brandMap.get(brandId) || 'Unknown Brand';
        
        // Find sales record for this brand
        let currentAttachRate = 0;
        let previousAttachRate = 0;
        
        for (const [key, salesData] of salesByBrand) {
          if (salesData.brandId === brandId) {
            const currentData = getMonthData(salesData.monthlySales, currentMonth);
            const previousData = getMonthData(salesData.monthlySales, previousMonth);
            
            currentAttachRate = getAttachRate(currentData);
            previousAttachRate = getAttachRate(previousData);
            break;
          }
        }

        // Calculate base RAG status
        const baseStatus = getBaseRAGStatus(brandType, currentAttachRate);
        
        // Apply performance drop rule
        const finalStatus = previousAttachRate > 0 
          ? applyPerformanceDropRule(baseStatus, currentAttachRate, previousAttachRate)
          : baseStatus;

        // Determine performance change
        let performanceChange: 'improved' | 'declined' | 'stable' = 'stable';
        if (previousAttachRate > 0) {
          if (currentAttachRate > previousAttachRate) performanceChange = 'improved';
          else if (currentAttachRate < previousAttachRate) performanceChange = 'declined';
        }

        brandRAGStatuses.push({
          brandType,
          brandName,
          currentAttachRate: Math.round(currentAttachRate * 100) / 100,
          previousAttachRate: Math.round(previousAttachRate * 100) / 100,
          baseStatus,
          finalStatus,
          performanceChange
        });
      });

      // Determine overall store RAG status (worst case among all brands)
      let overallStatus: RAGStatus = 'green';
      const statusPriority = { red: 3, amber: 2, green: 1 };
      
      brandRAGStatuses.forEach(brandStatus => {
        if (statusPriority[brandStatus.finalStatus] > statusPriority[overallStatus]) {
          overallStatus = brandStatus.finalStatus;
        }
      });

      // Apply RAG filter if specified
      if (ragFilter && ragFilter !== 'all') {
        if (overallStatus !== ragFilter) {
          return null; // Filter out this store
        }
      }

      return {
        id: store.id,
        storeName: store.storeName,
        city: store.city,
        address: store.fullAddress || store.city,
        partnerBrands,
        ragStatus: overallStatus,
        brandRAGDetails: brandRAGStatuses,
        // Summary metrics
        totalBrands: brandRAGStatuses.length,
        greenBrands: brandRAGStatuses.filter(b => b.finalStatus === 'green').length,
        amberBrands: brandRAGStatuses.filter(b => b.finalStatus === 'amber').length,
        redBrands: brandRAGStatuses.filter(b => b.finalStatus === 'red').length,
        // Performance indicators
        improvingBrands: brandRAGStatuses.filter(b => b.performanceChange === 'improved').length,
        decliningBrands: brandRAGStatuses.filter(b => b.performanceChange === 'declined').length,
        stableBrands: brandRAGStatuses.filter(b => b.performanceChange === 'stable').length
      };
    });

    // Filter out null values and sort by RAG status priority
    const filteredStores = processedStores
      .filter(store => store !== null)
      .sort((a, b) => {
        const statusPriority = { red: 3, amber: 2, green: 1 };
        return statusPriority[b.ragStatus] - statusPriority[a.ragStatus];
      });

    // Calculate summary statistics
    const summary = {
      total: filteredStores.length,
      green: filteredStores.filter(s => s.ragStatus === 'green').length,
      amber: filteredStores.filter(s => s.ragStatus === 'amber').length,
      red: filteredStores.filter(s => s.ragStatus === 'red').length,
      // Performance trends
      improving: filteredStores.filter(s => s.improvingBrands > s.decliningBrands).length,
      declining: filteredStores.filter(s => s.decliningBrands > s.improvingBrands).length,
      stable: filteredStores.filter(s => s.improvingBrands === s.decliningBrands).length
    };

    return NextResponse.json({
      stores: filteredStores,
      summary,
      metadata: {
        currentMonth,
        previousMonth,
        year,
        criteria: RAG_CRITERIA,
        filtersApplied: {
          city: city || 'All',
          partnerBrand: partnerBrand || 'All',
          ragStatus: ragFilter || 'all'
        }
      }
    });

  } catch (error) {
    console.error('RAG Status API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}