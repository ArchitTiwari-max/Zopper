import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractChainPrefix, getAllChainConfigs } from '@/lib/chainConfig';

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

    // Fetch stores, brands, and alignments in parallel
    const [stores, allBrands, alignments] = await Promise.all([
      prisma.store.findMany({
        where: {
          id: { in: executive.executiveStores.map(es => es.storeId) }
        },
        select: {
          id: true,
          storeName: true,
          city: true,
          fullAddress: true,
          latitude: true,
          longitude: true,
          partnerBrandIds: true,
          partnerBrandTypes: true,
          visits: {
            where: { executiveId: executive.id },
            orderBy: { visitDate: 'desc' },
            take: 1
          }
        }
      }),
      prisma.brand.findMany({ select: { id: true, brandName: true } }),
      prisma.storeAlignment.findMany({
        where: { storeId: { in: executive.executiveStores.map(es => es.storeId) } }
      })
    ]);

    const brandMap = new Map(allBrands.map(brand => [brand.id, brand]));
    const alignmentMap = new Map(alignments.map(a => [a.storeId, a]));

    // Load all chain configs once for efficient score calculation
    const chainConfigs = await getAllChainConfigs();

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
        lastVisitDate = lastVisit.visitDate || lastVisit.createdAt;
        const now = new Date();
        const visitDate = new Date(lastVisit.visitDate || lastVisit.createdAt);
        const diffDays = Math.floor(Math.abs(now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) visitStatus = 'Today';
        else if (diffDays === 1) visitStatus = '1 day ago';
        else visitStatus = `${diffDays} days ago`;
      }

      // Calculate Alignment Score using chain config
      let alignmentScore = 0;
      const alignment = alignmentMap.get(store.id);
      if (alignment) {
        const storePrefix = extractChainPrefix(store.storeName);
        const chainConfig = chainConfigs.find(
          c => c.prefix.toUpperCase() === storePrefix.toUpperCase() &&
               !c.excludedStoreIds.includes(store.id)
        ) || null;

        if (chainConfig) {
          const storeLevel = Array.isArray(alignment.storeLevel) ? alignment.storeLevel : [];
          const stakeholderLevel = Array.isArray(alignment.stakeholderLevel) ? alignment.stakeholderLevel : [];

          const isRoleAligned = (roleName: string, levelData: any[]) => {
            const roleEntry = levelData.find((r: any) => r.role?.trim().toUpperCase() === roleName.toUpperCase());
            if (!roleEntry || !roleEntry.personnel) return false;
            return roleEntry.personnel.some((p: any) =>
              p.name?.trim() !== '' && /^[0-9]{10}$/.test(p.phone?.trim() || '')
            );
          };

          for (const { role, weight } of (chainConfig.storeRoles as any[])) {
            if (isRoleAligned(role, storeLevel)) alignmentScore += weight;
          }
          for (const { role, weight } of (chainConfig.stakeholderRoles as any[])) {
            if (isRoleAligned(role, stakeholderLevel)) alignmentScore += weight;
          }
          alignmentScore = Math.min(alignmentScore, 100);
        }
      }

      return {
        id: store.id,
        storeName: store.storeName,
        city: store.city,
        fullAddress: store.fullAddress,
        latitude: store.latitude ?? null,
        longitude: store.longitude ?? null,
        partnerBrands,
        partnerBrandTypes,
        visited: visitStatus,
        lastVisitDate,
        isFlagged: flaggedMap.get(store.id) || false,
        sortOrder: lastVisitDate ? new Date(lastVisitDate).getTime() : 0,
        alignmentScore
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
