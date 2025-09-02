import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive from user ID
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }

    // Get date period from query params
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'Last 30 Days';

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Execute ALL queries in parallel for maximum performance (CRITICAL for N+1 prevention)
    const [storeData, allBrands, visits, taskStats] = await Promise.all([
      // Get stores assigned to this executive
      prisma.store.findMany({
        where: {
          id: {
            in: executive.assignedStoreIds
          }
        },
        select: {
          partnerBrandIds: true
        }
      }),
      
      // Get all brands (we'll filter after to avoid sequential dependency)
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true,
          category: true
        }
      }),
      
      // Get executive visits with brand filtering for efficiency
      prisma.visit.findMany({
        where: {
          executiveId: executive.id,
          createdAt: {
            gte: startDate,
            lte: now
          }
        },
        select: {
          brandIds: true
        }
      }),
      
      // Get task counts using groupBy (single query)
      prisma.assigned.groupBy({
        by: ['status'],
        where: {
          executiveId: executive.id
        },
        _count: {
          id: true
        }
      })
    ]);

    // Extract unique brand IDs from the executive's assigned stores
    const uniqueBrandIds = Array.from(
      new Set(storeData.flatMap(store => store.partnerBrandIds))
    );

    // Filter brands to only include those assigned to the executive's stores
    const relevantBrands = allBrands.filter(brand => uniqueBrandIds.includes(brand.id));
    
    // Sort brands alphabetically
    relevantBrands.sort((a, b) => a.brandName.localeCompare(b.brandName));

    // Create a Set of relevant brand IDs for fast lookup
    const relevantBrandIds = new Set(uniqueBrandIds);

    // Calculate brand visit counts with filtering for only relevant brands
    const brandVisitMap = new Map<string, number>();
    
    // Count visits for each relevant brand only
    visits.forEach(visit => {
      visit.brandIds.forEach(brandId => {
        // Only count visits for brands that are relevant to this executive
        if (relevantBrandIds.has(brandId)) {
          brandVisitMap.set(brandId, (brandVisitMap.get(brandId) || 0) + 1);
        }
      });
    });

    // Build brand visit counts array using only relevant brands
    const brandVisitCounts = relevantBrands.map(brand => ({
      id: brand.id,
      name: brand.brandName,
      category: brand.category,
      visits: brandVisitMap.get(brand.id) || 0
    }));

    // Calculate task statistics
    const pendingTasks = taskStats
      .filter(stat => ['Assigned', 'In_Progress'].includes(stat.status))
      .reduce((sum, stat) => sum + stat._count.id, 0);
      
    const completedTasks = taskStats
      .find(stat => stat.status === 'Completed')?._count.id || 0;
      
    const totalVisits = visits.length;

    return NextResponse.json({
      success: true,
      data: {
        brandVisits: brandVisitCounts,
        totalVisits: totalVisits,
        tasks: {
          pending: pendingTasks,
          completed: completedTasks,
          total: pendingTasks + completedTasks
        },
        period: period
      }
    });

  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
