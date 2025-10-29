import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

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

    // Get date filter from query params
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';

    // Calculate date range based on filter
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (dateFilter) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // For 'Today', include the entire day until 23:59:59
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        endDate.setMilliseconds(-1); // Set to 23:59:59.999
        break;
      case 'Yesterday':
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        startDate = yesterday;
        // For 'Yesterday', include the entire day until 23:59:59
        endDate = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
        break;
      case 'Last Year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
    }

    // Get dashboard metrics concurrently (OPTIMIZED)
    const [
      totalVisitsData,
      pendingReviewsData, 
      pendingIssuesData,
      previousVisitsData,
      brandVisitsData
    ] = await Promise.all([
      // Total visits in date range
      prisma.visit.aggregate({
        _count: true,
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Pending reviews
      prisma.visit.aggregate({
        _count: true,
        where: {
          status: 'PENDING_REVIEW',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Pending issues (Pending + Assigned status) in date range  
      prisma.issue.aggregate({
        _count: true,
        where: {
          status: {
            in: ['Pending', 'Assigned']
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Previous period visits (moved into Promise.all)
      prisma.visit.aggregate({
        _count: true,
        where: {
          createdAt: {
            gte: new Date(startDate.getTime() - (now.getTime() - startDate.getTime())),
            lt: startDate
          }
        }
      }),

      // Brand-wise visit data (OPTIMIZED)
      getBrandVisitDataOptimized(startDate, endDate)
    ]);

    // Calculate percentage change (previous query moved to Promise.all)
    const currentVisits = totalVisitsData._count;
    const previousVisits = previousVisitsData._count;
    const changePercent = previousVisits > 0 
      ? Math.round(((currentVisits - previousVisits) / previousVisits) * 100)
      : 0;

    const changeText = `${changePercent >= 0 ? '+' : ''}${changePercent}% from previous period`;

    // Format response
    const dashboardData = {
      totalVisits: {
        count: currentVisits,
        change: changeText,
        trend: changePercent >= 0 ? 'up' : 'down'
      },
      pendingReviews: {
        count: pendingReviewsData._count,
        status: pendingReviewsData._count > 20 ? 'Needs attention' : 'Under control',
        trend: pendingReviewsData._count > 20 ? 'warning' : 'active'
      },
      issuesReported: {
        count: pendingIssuesData._count,
        status: pendingIssuesData._count > 10 ? 'Requires resolution' : 'Manageable',
        trend: pendingIssuesData._count > 10 ? 'critical' : 'warning'
      },
      brandData: brandVisitsData
    };

    // Add caching headers - PRIVATE cache for admin data security
    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', // 5min private cache
        'Vary': 'Authorization', // Ensure different admins get separate cache
      }
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// OPTIMIZED: Faster brand visit data with limits
async function getBrandVisitDataOptimized(startDate: Date, endDate: Date) {
  try {
    // Get brands and visits in parallel - get ALL brands to show even those with 0 visits
    const [brands, visits] = await Promise.all([
      // Get ALL brands to show even those with 0 visits
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true
        },
        orderBy: {
          brandName: 'asc'
        }
      }),

      // Get ALL visits within the date period (no limit needed since period filter already limits data)
      prisma.visit.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          brandIds: true,
          storeId: true
        }
      })
    ]);

    // Process brand visit data (optimized)
    const brandVisitMap = new Map<string, {
      name: string,
      visits: number,
      uniqueStores: Set<string>
    }>();

    // Initialize map with ALL brands (including those with 0 visits)
    brands.forEach(brand => {
      brandVisitMap.set(brand.id, {
        name: brand.brandName,
        visits: 0,
        uniqueStores: new Set<string>()
      });
    });

    // Count visits and unique stores per brand
    visits.forEach(visit => {
      visit.brandIds.forEach(brandId => {
        const brandData = brandVisitMap.get(brandId);
        if (brandData) {
          brandData.visits += 1;
          brandData.uniqueStores.add(visit.storeId);
        }
      });
    });

    // Convert to array and format for frontend - show ALL brands including 0 visits
    const brandData = Array.from(brandVisitMap.entries())
      .map(([brandId, data], index) => ({
        id: index + 1,
        name: data.name,
        logo: data.name.charAt(0).toUpperCase(),
        visits: data.visits,
        uniqueStores: data.uniqueStores.size,
        color: getBrandColor(data.name)
      }))
      // Remove filter - show ALL brands even with 0 visits
      .sort((a, b) => b.visits - a.visits); // Sort by visits descending, brands with 0 visits will be at the end

    return brandData;

  } catch (error) {
    console.error('Error getting optimized brand visit data:', error);
    return [];
  }

}

// Keep original function as fallback
async function getBrandVisitData(startDate: Date, endDate: Date) {
  try {
    // Get all brands
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        brandName: true,
        // category field removed - using CategoryBrand relation
      }
    });

    // Get visit data with brand information
    const visits = await prisma.visit.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        brandIds: true,
        storeId: true
      }
    });

    // Process brand visit data
    const brandVisitMap = new Map<string, {
      name: string,
      category: string,
      visits: number,
      uniqueStores: Set<string>
    }>();

    // Initialize map with all brands
    brands.forEach(brand => {
      brandVisitMap.set(brand.id, {
        name: brand.brandName,
        category: 'General', // TODO: Implement category lookup via CategoryBrand relation
        visits: 0,
        uniqueStores: new Set<string>()
      });
    });

    // Count visits and unique stores per brand
    visits.forEach(visit => {
      visit.brandIds.forEach(brandId => {
        const brandData = brandVisitMap.get(brandId);
        if (brandData) {
          brandData.visits += 1;
          brandData.uniqueStores.add(visit.storeId);
        }
      });
    });

    // Convert to array and format for frontend
    const brandData = Array.from(brandVisitMap.entries()).map(([brandId, data], index) => {
      return {
        id: index + 1,
        name: data.name,
        logo: data.name.charAt(0).toUpperCase(),
        visits: data.visits,
        uniqueStores: data.uniqueStores.size,
        color: getBrandColor(data.name)
      };
    });

    // Sort by visit count descending and take top 10
    return brandData
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

  } catch (error) {
    console.error('Error getting brand visit data:', error);
    return [];
  }
}

function getBrandColor(brandName: string): string {
  const colors = [
    '#3B82F6', // Blue
    '#EF4444', // Red  
    '#F97316', // Orange
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F59E0B', // Amber/Yellow
    '#06B6D4', // Cyan
    '#8D4E85', // Mauve
    '#DC2626', // Dark Red
    '#7C3AED', // Violet
    '#BE185D', // Deep Pink
    '#0EA5E9'  // Sky Blue
  ];
  
  // Generate consistent color based on brand name
  const hash = brandName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return colors[Math.abs(hash) % colors.length];
}
