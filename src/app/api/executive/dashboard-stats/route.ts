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

    // Execute all queries in parallel for maximum performance
    const [brands, visits, taskStats] = await Promise.all([
      // Get all brands
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true,
          category: true
        },
        orderBy: {
          brandName: 'asc'
        }
      }),
      
      // Get all executive visits in date range (single query)
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

    // Calculate brand visit counts from the single visits query
    const brandVisitMap = new Map<string, number>();
    
    // Count visits for each brand
    visits.forEach(visit => {
      visit.brandIds.forEach(brandId => {
        brandVisitMap.set(brandId, (brandVisitMap.get(brandId) || 0) + 1);
      });
    });

    // Build brand visit counts array
    const brandVisitCounts = brands.map(brand => ({
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
