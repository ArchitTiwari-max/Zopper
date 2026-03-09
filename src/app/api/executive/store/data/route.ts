import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive data
    let executive;
    try {
      executive = await prisma.executive.findUnique({
        where: { userId: user.userId },
        include: {
          user: true,
          executiveStores: {
            select: { storeId: true, isFlagged: true }
          }
        }
      });
    } catch (dbError) {
      console.error('Database error fetching executive:', dbError);
      return NextResponse.json({ error: 'Database error fetching executive profile' }, { status: 500 });
    }

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Create a map for quick lookup of flagged status
    const flaggedMap = new Map<string, boolean>();
    executive.executiveStores.forEach(es => {
      flaggedMap.set(es.storeId, es.isFlagged);
    });

    // ETag for cache validation (includes user ID for security)
    const currentTime = Math.floor(Date.now() / (1 * 60 * 1000)) * (1 * 60 * 1000);
    const apiVersion = 'v2-data-only';
    const etag = `"${currentTime}-${executive.id}-${user.userId}-${apiVersion}"`;
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

    // Fetch stores and brands in parallel
    const [stores, allBrands] = await Promise.all([
      prisma.store.findMany({
        where: {
          id: { in: executive.executiveStores.map(es => es.storeId) }
        },
        include: {
          visits: {
            where: { executiveId: executive.id },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }),
      prisma.brand.findMany({ select: { id: true, brandName: true } })
    ]);

    const brandMap = new Map(allBrands.map(brand => [brand.id, brand]));

    const transformedStores = stores.map(store => {
      const partnerBrands = store.partnerBrandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean)
        .map(b => b!.brandName);

      // Get partner brand types - ensure we have the same length as brand IDs
      const partnerBrandTypes = Array.isArray((store as any).partnerBrandTypes)
        ? (store as any).partnerBrandTypes
        : [];

      let visitStatus = 'No visit';
      let lastVisitDate: Date | null = null;

      if (store.visits.length > 0) {
        const lastVisit = store.visits[0];
        lastVisitDate = lastVisit.createdAt;
        const now = new Date();
        const visitDate = new Date(lastVisit.createdAt);
        const diffDays = Math.floor(Math.abs(now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) visitStatus = 'Today';
        else if (diffDays === 1) visitStatus = '1 day ago';
        else visitStatus = `${diffDays} days ago`;
      }

      return {
        id: store.id,
        storeName: store.storeName,
        city: store.city,
        fullAddress: store.fullAddress,
        partnerBrands,
        partnerBrandTypes,
        visited: visitStatus,
        lastVisitDate,
        isFlagged: flaggedMap.get(store.id) || false,
        sortOrder: lastVisitDate ? new Date(lastVisitDate).getTime() : 0
      };
    });

    transformedStores.sort((a, b) => {
      if (a.sortOrder === 0 && b.sortOrder === 0) return 0;
      if (a.sortOrder === 0) return 1;
      if (b.sortOrder === 0) return -1;
      return b.sortOrder - a.sortOrder;
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      data: {
        stores: transformedStores,
        executive: {
          id: executive.id,
          name: executive.name,
          region: executive.region
        }
      }
    });

    // ===== SAFE HEADERS =====
    response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=60'); // Browser-only cache
    response.headers.set('ETag', etag); // Conditional requests
    response.headers.set('X-Content-Type-Options', 'nosniff'); // Security
    response.headers.set('X-Cache-Status', 'MISS'); // Debug info
    response.headers.set('Vary', 'Cookie'); // Cache varies by cookies (user session)

    return response;

  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

// PUT endpoint to update store partner brands
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user from token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const { storeId, brandIds } = await request.json();

    if (!storeId || !brandIds) {
      return NextResponse.json({ error: 'Store ID and brand IDs are required' }, { status: 400 });
    }

    // Update store with new partner brand IDs
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        partnerBrandIds: brandIds
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedStore
    });

  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json(
      { error: 'Failed to update store' },
      { status: 500 }
    );
  }
}
