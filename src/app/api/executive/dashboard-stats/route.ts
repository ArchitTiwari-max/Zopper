import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

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

    // Get executive from user ID with store assignments
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      include: {
        executiveStores: {
          select: { storeId: true }
        }
      }
    });

    if (!executive) {
      return NextResponse.json({ success: false, error: 'Executive profile not found' }, { status: 404 });
    }

    // Get period from query params
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

    // Fetch all data in parallel
    const [storeData, allBrands, visits, pendingTasksCount, completedTasksCount] = await Promise.all([
      prisma.store.findMany({
        where: { id: { in: executive.executiveStores.map(es => es.storeId) } },
        select: { partnerBrandIds: true }
      }),
      prisma.brand.findMany({ select: { id: true, brandName: true } }),
      prisma.visit.findMany({
        where: { executiveId: executive.id, createdAt: { gte: startDate, lte: now } },
        select: { brandIds: true }
      }),
      // MongoDB provider does not support groupBy in Prisma. Use count queries instead.
      prisma.assigned.count({
        where: { executiveId: executive.id, status: { in: ['Assigned', 'In_Progress'] } }
      }),
      prisma.assigned.count({
        where: { executiveId: executive.id, status: 'Completed' }
      })
    ]);

    // Filter relevant brands
    const uniqueBrandIds = Array.from(new Set(storeData.flatMap(s => s.partnerBrandIds)));
    const relevantBrands = allBrands.filter(b => uniqueBrandIds.includes(b.id));
    const relevantBrandIds = new Set(uniqueBrandIds);

    // Count visits for relevant brands
    const brandVisitMap = new Map<string, number>();
    visits.forEach(visit => {
      visit.brandIds.forEach(brandId => {
        if (relevantBrandIds.has(brandId)) {
          brandVisitMap.set(brandId, (brandVisitMap.get(brandId) || 0) + 1);
        }
      });
    });

    const brandVisitCounts = relevantBrands.map(brand => ({
      id: brand.id,
      name: brand.brandName,
      category: 'General',
      visits: brandVisitMap.get(brand.id) || 0
    })).sort((a, b) => b.visits - a.visits);

    // Task stats
    const pendingTasks = pendingTasksCount;
    const completedTasks = completedTasksCount;
    const totalVisits = visits.length;

    // -----------------------------
    // Send response with no caching for real-time data
    // -----------------------------
    const response = NextResponse.json({
      success: true,
      data: {
        brandVisits: brandVisitCounts,
        totalVisits,
        tasks: { pending: pendingTasks, completed: completedTasks, total: pendingTasks + completedTasks },
        period
      }
    });

    // Disable caching completely for real-time dashboard updates
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie');

    return response;

  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard statistics' }, { status: 500 });
  }
}
