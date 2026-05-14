import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });

    // ── 1) Get executive + assigned store IDs ─────────────────────────────────
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        executiveStores: { select: { storeId: true } }
      }
    });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const assignedStoreIds = executive.executiveStores.map(es => es.storeId);

    // ── ETag ──────────────────────────────────────────────────────────────────
    const currentTime = Math.floor(Date.now() / (10 * 60 * 1000)) * (10 * 60 * 1000); // 10-min buckets
    const etag = `"${currentTime}-${executive.id}-v2-filter"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { 
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'ETag': etag, 
          'X-Cache-Status': 'HIT',
          'Vary': 'Cookie'
        }
      });
    }

    const CHUNK = 500;
    const storeChunks = chunk(assignedStoreIds, CHUNK);

    // ── 2) Fetch stores + all brands IN PARALLEL ──────────────────────────────
    const [storesNested, allBrands] = await Promise.all([
      Promise.all(storeChunks.map(ids =>
        prisma.store.findMany({
          where: { id: { in: ids } },
          select: { id: true, storeName: true, city: true, partnerBrandIds: true }
        })
      )),
      prisma.brand.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: 'asc' } })
    ]);

    const allStores = storesNested.flat();

    // ── 3) Derive filter options (pure in-memory) ─────────────────────────────
    const allCities = Array.from(new Set(allStores.map(s => s.city))).sort();

    const usedBrandIds = new Set(allStores.flatMap(s => s.partnerBrandIds));
    const usedBrands   = allBrands.filter(b => usedBrandIds.has(b.id)).map(b => b.brandName);
    const allBrandNames = allBrands.map(b => b.brandName);

    const sortOptions = [
      'Recently Visited First',
      'Store Name A-Z',
      'Store Name Z-A',
      'City A-Z',
      'City Z-A'
    ];

    const statusOptions = [
      'All Status',
      'Visited Today',
      'Visited This Week',
      'Visited This Month',
      'Not Visited',
      'Overdue Visit'
    ];

    const response = NextResponse.json({
      success: true,
      data: {
        filterOptions: {
          cities:              ['All Cities', ...allCities],
          brands:              ['All Brands', ...allBrandNames],
          sortOptions,
          statusOptions,
          currentlyUsedBrands: ['All Brands', ...usedBrands],
          brandCategories:     ['All Categories', 'General'],
          totalStores:         allStores.length,
          totalCities:         allCities.length,
          totalBrands:         allBrands.length,
          totalUsedBrands:     usedBrands.length
        },
        metadata: {
          executiveId:          executive.id,
          assignedStoresCount:  assignedStoreIds.length,
          generatedAt:          new Date().toISOString()
        }
      }
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Vary', 'Cookie');
    response.headers.set('ETag', etag);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Cache-Status', 'MISS');

    return response;

  } catch (error) {
    console.error('Error fetching filter data:', error);
    return NextResponse.json({ error: 'Failed to fetch filter data' }, { status: 500 });
  }
}
