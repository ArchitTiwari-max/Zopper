import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractChainPrefix, getAllChainConfigs } from '@/lib/chainConfig';

export const runtime = 'nodejs';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Allow both EXECUTIVE and ADMIN roles
    if (user.role !== 'EXECUTIVE' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Executive or Admin role required.' }, { status: 403 });
    }

    // If ADMIN, fetch all stores instead of executive-specific stores
    if (user.role === 'ADMIN') {
      const stores = await prisma.store.findMany({
        select: {
          id: true,
          storeName: true,
          city: true,
          fullAddress: true,
          latitude: true,
          longitude: true,
          partnerBrandIds: true,
          partnerBrandTypes: true,
        },
        orderBy: {
          storeName: 'asc'
        }
      });

      const allBrands = await prisma.brand.findMany({ select: { id: true, brandName: true } });
      const brandMap = new Map(allBrands.map(b => [b.id, b.brandName]));

      const transformedStores = stores.map(store => {
        const partnerBrands = store.partnerBrandIds
          .map(bid => brandMap.get(bid))
          .filter(Boolean) as string[];

        const partnerBrandTypes = Array.isArray((store as any).partnerBrandTypes)
          ? (store as any).partnerBrandTypes : [];

        return {
          id: store.id,
          storeName: store.storeName,
          city: store.city,
          fullAddress: store.fullAddress,
          latitude: store.latitude ?? null,
          longitude: store.longitude ?? null,
          partnerBrands,
          partnerBrandTypes,
          visited: 'N/A',
          lastVisitDate: null,
          isFlagged: false,
          sortOrder: 0,
          alignmentScore: 0
        };
      });

      return NextResponse.json({
        success: true,
        stores: transformedStores
      });
    }

    // ── 1) Get executive + store IDs + flagged map ────────────────────────────
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        region: true,
        executiveStores: { select: { storeId: true, isFlagged: true } }
      }
    });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const flaggedMap = new Map<string, boolean>(
      executive.executiveStores.map(es => [es.storeId, es.isFlagged])
    );
    const assignedStoreIds = executive.executiveStores.map(es => es.storeId);
    if (assignedStoreIds.length === 0) {
      return NextResponse.json({ success: true, data: { stores: [], executive: { id: executive.id, name: executive.name, region: executive.region } } });
    }

    // ── ETag for cache validation ────────────────────────────────────────────
    const currentTime = Math.floor(Date.now() / (1 * 60 * 1000)) * (1 * 60 * 1000);
    const etag = `"${currentTime}-${executive.id}-${user.userId}-v3"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { 
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'ETag': etag,
          'Vary': 'Cookie'
        }
      });
    }

    const CHUNK = 500;
    const storeChunks = chunk(assignedStoreIds, CHUNK);

    // ── 2) Fetch stores + last visit per store + brands + alignments + chainConfigs IN PARALLEL ──
    const [storesNested, lastVisitsNested, allBrands, alignments, chainConfigs] = await Promise.all([
      // Store details — NO nested visits (fetched separately via groupBy)
      Promise.all(storeChunks.map(ids =>
        prisma.store.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            storeName: true,
            city: true,
            fullAddress: true,
            latitude: true,
            longitude: true,
            partnerBrandIds: true,
            partnerBrandTypes: true,
          }
        })
      )),

      // Last visit date per store (groupBy is far more efficient than nested include)
      Promise.all(storeChunks.map(ids =>
        prisma.visit.groupBy({
          by: ['storeId'],
          where: { storeId: { in: ids }, executiveId: executive.id },
          _max: { visitDate: true }
        })
      )),

      prisma.brand.findMany({ select: { id: true, brandName: true } }),
      prisma.storeAlignment.findMany({ where: { storeId: { in: assignedStoreIds } } }),
      getAllChainConfigs(),
    ]);

    const stores       = storesNested.flat();
    const lastVisits   = lastVisitsNested.flat();
    const brandMap     = new Map(allBrands.map(b => [b.id, b.brandName]));
    const alignmentMap = new Map(alignments.map(a => [a.storeId, a]));

    // Build O(1) last-visit lookup
    const lastVisitMap = new Map<string, Date | null>(
      lastVisits.map(v => [v.storeId, v._max.visitDate ?? null])
    );

    const now = new Date();

    const transformedStores = stores.map(store => {
      const partnerBrands = store.partnerBrandIds
        .map(bid => brandMap.get(bid))
        .filter(Boolean) as string[];

      const partnerBrandTypes = Array.isArray((store as any).partnerBrandTypes)
        ? (store as any).partnerBrandTypes : [];

      // Last visit status
      let visitStatus = 'No visit';
      const lastVisitDate = lastVisitMap.get(store.id) ?? null;
      if (lastVisitDate) {
        const diffDays = Math.floor((now.getTime() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0)      visitStatus = 'Today';
        else if (diffDays === 1) visitStatus = '1 day ago';
        else                     visitStatus = `${diffDays} days ago`;
      }

      // Alignment score
      let alignmentScore = 0;
      const alignment = alignmentMap.get(store.id);
      if (alignment) {
        const storePrefix = extractChainPrefix(store.storeName);
        const chainConfig = chainConfigs.find(
          c => c.prefix.toUpperCase() === storePrefix.toUpperCase() &&
               !c.excludedStoreIds.includes(store.id)
        ) || null;

        if (chainConfig) {
          const storeLevel       = Array.isArray(alignment.storeLevel)       ? alignment.storeLevel       : [];
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

    const response = NextResponse.json({
      success: true,
      data: {
        stores: transformedStores,
        executive: { id: executive.id, name: executive.name, region: executive.region }
      }
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('ETag', etag);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('Vary', 'Cookie');

    return response;

  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

// PUT endpoint to update store partner brands — unchanged
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });

    const { storeId, brandIds } = await request.json();
    if (!storeId || !brandIds) return NextResponse.json({ error: 'Store ID and brand IDs are required' }, { status: 400 });

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { partnerBrandIds: brandIds }
    });

    return NextResponse.json({ success: true, data: updatedStore });
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}
