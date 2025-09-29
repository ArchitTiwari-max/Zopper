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
    const [storeData, allBrands, visits, taskStats] = await Promise.all([
      prisma.store.findMany({
        where: { id: { in: executive.executiveStores.map(es => es.storeId) } },
        select: { partnerBrandIds: true }
      }),
      prisma.brand.findMany({ select: { id: true, brandName: true } }),
      prisma.visit.findMany({
        where: { executiveId: executive.id, createdAt: { gte: startDate, lte: now } },
        select: { brandIds: true }
      }),
      prisma.assigned.groupBy({
        by: ['status'],
        where: { executiveId: executive.id },
        _count: { id: true }
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
    const pendingTasks = taskStats.filter(stat => ['Assigned', 'In_Progress'].includes(stat.status))
      .reduce((sum, stat) => sum + stat._count.id, 0);
    const completedTasks = taskStats.find(stat => stat.status === 'Completed')?._count.id || 0;
    const totalVisits = visits.length;

    // -----------------------------
    // 1️⃣ Generate per-user data hash for ETag
    // -----------------------------
    const dataString = JSON.stringify({ brandVisitCounts, pendingTasks, completedTasks, totalVisits, period });
    const crypto = await import('crypto'); // Node.js crypto
    const dataHash = crypto.createHash('md5').update(dataString).digest('hex');
    const etag = `"${executive.id}-${dataHash}"`;

    // -----------------------------
    // 2️⃣ Conditional request check
    // -----------------------------
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=60',
          'ETag': etag
        }
      });
    }

    // -----------------------------
    // 3️⃣ Send response with safe headers
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

    // Browser-only caching, safe for multi-user
    response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');
    response.headers.set('ETag', etag);

    return response;

  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard statistics' }, { status: 500 });
  }
}
