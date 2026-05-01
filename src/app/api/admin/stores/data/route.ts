import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ── Query params ──────────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);

    const partnerBrand        = searchParams.get('partnerBrand');        // brand name
    const partnerBrandType    = searchParams.get('partnerBrandType');    // A+/A/B/C/D
    const city                = searchParams.get('city');
    const storeFilterId       = searchParams.get('storeId');
    const executiveFilterId   = searchParams.get('executiveId');
    const storeSearchText     = searchParams.get('storeSearchText') || '';
    const showOnlyUnresolved  = searchParams.get('showOnlyUnresolvedIssues') === 'true';
    const showOnlyUnreviewed  = searchParams.get('showOnlyUnreviewedVisits') === 'true';
    const dateFilter          = searchParams.get('dateFilter') || 'Last 30 Days';
    const isExport            = searchParams.get('isExport') === 'true';

    // Pagination
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1',  10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip  = isExport ? 0 : (page - 1) * limit;
    const take  = isExport ? 10_000 : limit;

    // ── Date range ────────────────────────────────────────────────────────────
    const now = new Date();
    let startDate: Date;
    switch (dateFilter) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'Last Year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // ── Resolve brand ID from brand name (for DB-level filter) ────────────────
    let brandFilterId: string | null = null;
    let brandFilterTypeValue: string | null = null;

    if (partnerBrand && partnerBrand !== 'All Brands') {
      const brand = await prisma.brand.findFirst({
        where: { brandName: partnerBrand },
        select: { id: true }
      });
      if (!brand) {
        // Brand not found → return empty
        return NextResponse.json({ stores: [], total: 0, totalPages: 0 });
      }
      brandFilterId = brand.id;
    }

    if (partnerBrandType && partnerBrandType !== 'All Category') {
      brandFilterTypeValue = partnerBrandType === 'A+' ? 'A_PLUS' : partnerBrandType;
    }

    // ── Resolve executive → store IDs (for DB-level filter) ───────────────────
    let execAssignedStoreIds: string[] | null = null;
    if (executiveFilterId && executiveFilterId !== 'All Executive') {
      const assignments = await prisma.executiveStoreAssignment.findMany({
        where: { executiveId: executiveFilterId },
        select: { storeId: true }
      });
      execAssignedStoreIds = assignments.map(a => a.storeId);
      if (execAssignedStoreIds.length === 0) {
        return NextResponse.json({ stores: [], total: 0, totalPages: 0 });
      }
    }

    // ── Resolve "unresolved issues" store IDs (for DB-level filter) ───────────
    let unresolvedIssueStoreIds: string[] | null = null;
    if (showOnlyUnresolved) {
      const issueRows = await prisma.issue.findMany({
        where: {
          status: { in: ['Pending', 'Assigned'] },
          createdAt: { gte: startDate, lte: now }
        },
        select: { visit: { select: { storeId: true } } }
      });
      unresolvedIssueStoreIds = [...new Set(issueRows.filter(r => r.visit != null).map(r => r.visit!.storeId))];
      if (unresolvedIssueStoreIds.length === 0) {
        return NextResponse.json({ stores: [], total: 0, totalPages: 0 });
      }
    }

    // ── Resolve "unreviewed visits" store IDs (for DB-level filter) ───────────
    let unreviewedVisitStoreIds: string[] | null = null;
    if (showOnlyUnreviewed) {
      const visitRows = await prisma.visit.findMany({
        where: {
          status: 'PENDING_REVIEW',
          visitDate: { gte: startDate, lte: now }
        },
        select: { storeId: true }
      });
      unreviewedVisitStoreIds = [...new Set(visitRows.map(r => r.storeId))];
      if (unreviewedVisitStoreIds.length === 0) {
        return NextResponse.json({ stores: [], total: 0, totalPages: 0 });
      }
    }

    // ── Build final store WHERE clause ────────────────────────────────────────
    const whereClause: any = {};

    // Single store filter
    if (storeFilterId && storeFilterId !== 'All Store') {
      whereClause.id = storeFilterId;
    }

    // City filter
    if (city && city !== 'All City') {
      whereClause.city = city;
    }

    // Store name search (partial, case-insensitive)
    if (storeSearchText.trim()) {
      whereClause.storeName = {
        contains: storeSearchText.trim(),
        mode: 'insensitive'
      };
    }

    // Brand ID filter at DB level
    if (brandFilterId) {
      whereClause.partnerBrandIds = {
        has: brandFilterId
      };
    }

    // Brand type filter at DB level
    if (brandFilterTypeValue) {
      // partnerBrandTypes is an array of types aligned with partnerBrandIds
      whereClause.partnerBrandTypes = {
        has: brandFilterTypeValue
      };
    }

    // Intersect all store-ID-based filters
    const storeIdSets: string[][] = [];
    if (execAssignedStoreIds)      storeIdSets.push(execAssignedStoreIds);
    if (unresolvedIssueStoreIds)   storeIdSets.push(unresolvedIssueStoreIds);
    if (unreviewedVisitStoreIds)   storeIdSets.push(unreviewedVisitStoreIds);

    if (storeIdSets.length > 0) {
      // Intersect all sets
      const intersected = storeIdSets.reduce((acc, cur) => {
        const curSet = new Set(cur);
        return acc.filter(id => curSet.has(id));
      });
      if (intersected.length === 0) {
        return NextResponse.json({ stores: [], total: 0, totalPages: 0 });
      }
      // Merge with any existing id filter
      if (whereClause.id && typeof whereClause.id === 'string') {
        if (!intersected.includes(whereClause.id)) {
          return NextResponse.json({ stores: [], total: 0, totalPages: 0 });
        }
        // whereClause.id stays as single ID (already in the set)
      } else {
        whereClause.id = { in: intersected };
      }
    }

    // ── Step 1: Get all matching store IDs + names (lightweight) ─────────────
    // We need ALL IDs to sort by last-visit globally, then paginate
    const [allMatchingStores, lastVisitPerStore, brands, allExecutives] = await Promise.all([
      prisma.store.findMany({
        where: whereClause,
        select: { id: true, storeName: true }
      }),

      // Get last visit date per store for correct sorting
      prisma.visit.groupBy({
        by: ['storeId'],
        _max: { visitDate: true },
        orderBy: { _max: { visitDate: 'desc' } }
      }),

      prisma.brand.findMany({ select: { id: true, brandName: true } }),

      prisma.executive.findMany({
        select: {
          id: true,
          name: true,
          executiveStores: { select: { storeId: true } }
        }
      })
    ]);

    // ── Step 2: Sort store IDs — recent visit first, then alphabetical ────────
    const visitDateMap = new Map<string, Date | null>();
    lastVisitPerStore.forEach(v => {
      visitDateMap.set(v.storeId, v._max.visitDate ?? null);
    });

    const total = allMatchingStores.length;
    const sortedIds = allMatchingStores
      .sort((a, b) => {
        const aDate = visitDateMap.get(a.id) ?? null;
        const bDate = visitDateMap.get(b.id) ?? null;
        if (aDate && bDate) return bDate.getTime() - aDate.getTime();
        if (aDate && !bDate) return -1;  // a has visits → comes first
        if (!aDate && bDate) return 1;   // b has visits → comes first
        return a.storeName.localeCompare(b.storeName); // both no visits → alphabetical
      })
      .map(s => s.id);

    // ── Step 3: Slice for current page ────────────────────────────────────────
    const paginatedIds = isExport ? sortedIds : sortedIds.slice(skip, skip + take);

    if (paginatedIds.length === 0) {
      return NextResponse.json({ stores: [], total, totalPages: Math.ceil(total / limit) });
    }

    // ── Step 4: Fetch full data ONLY for the paginated IDs ───────────────────
    const stores = await prisma.store.findMany({
      where: { id: { in: paginatedIds } },
      select: {
        id: true,
        storeName: true,
        city: true,
        fullAddress: true,
        partnerBrandIds: true,
        partnerBrandTypes: true,
        visits: {
          orderBy: { visitDate: 'desc' },
          take: 1,            // only most-recent visit needed
          select: {
            id: true,
            visitDate: true,
            createdAt: true,
            status: true,
            executiveId: true
          }
        }
      }
    });

    // Re-order stores to match sorted paginatedIds order
    const storeById = new Map(stores.map(s => [s.id, s]));
    const orderedStores = paginatedIds.map(id => storeById.get(id)).filter(Boolean) as typeof stores;

    // ── Build lookup maps ─────────────────────────────────────────────────────
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));
    const executiveStoreMap = new Map<string, string>(); // storeId → executiveName
    allExecutives.forEach(exec => {
      exec.executiveStores.forEach(es => {
        executiveStoreMap.set(es.storeId, exec.name);
      });
    });

    const storeIds = orderedStores.map(s => s.id);

    // ── Bulk fetch pending issues + visit counts for this page only ───────────
    const [pendingIssueMap, recentVisitMap] = await Promise.all([
      prisma.issue.findMany({
        where: {
          visit: { storeId: { in: storeIds } },
          status: { in: ['Pending', 'Assigned'] },
          createdAt: { gte: startDate, lte: now }
        },
        select: { visit: { select: { storeId: true } } }
      }).then(rows => {
        const m = new Map<string, number>();
        rows.forEach(r => {
          if (!r.visit) return;
          const sid = r.visit.storeId;
          m.set(sid, (m.get(sid) || 0) + 1);
        });
        return m;
      }),

      prisma.visit.groupBy({
        by: ['storeId'],
        where: {
          storeId: { in: storeIds },
          visitDate: { gte: startDate, lte: now }
        },
        _count: { id: true }
      }).then(rows => {
        const m = new Map<string, number>();
        rows.forEach(r => m.set(r.storeId, r._count.id));
        return m;
      })
    ]);

    // ── Map to response shape ─────────────────────────────────────────────────
    const responseStores = orderedStores.map(store => {
      const partnerBrands = (store.partnerBrandIds || [])
        .map(id => brandMap.get(id))
        .filter(Boolean) as string[];

      const partnerBrandPairs = (store.partnerBrandIds || []).map((id, idx) => ({
        id,
        name: brandMap.get(id) || 'Unknown Brand',
        type: (store as any).partnerBrandTypes?.[idx] || null
      }));

      const lastVisit = store.visits[0]
        ? new Date(store.visits[0].visitDate || store.visits[0].createdAt).toISOString()
        : null;

      const pendingReviews = store.visits.filter(v => v.status === 'PENDING_REVIEW').length;

      return {
        id: store.id,
        storeName: store.storeName,
        city: store.city,
        address: store.fullAddress || store.city,
        partnerBrands,
        partnerBrandPairs,
        assignedTo: executiveStoreMap.get(store.id) || 'Not Assigned',
        pendingIssues: pendingIssueMap.get(store.id) || 0,
        totalVisits: recentVisitMap.get(store.id) || 0,
        pendingReviews,
        status: (recentVisitMap.get(store.id) || 0) > 0 ? 'Active' : 'Inactive',
        lastVisit,
        contactPerson: 'Store Manager'
      };
    });

    const totalPages = Math.ceil(total / limit);

    // ── Response with cache headers ───────────────────────────────────────────
    const response = NextResponse.json({
      stores: responseStores,
      total,
      totalPages,
      page,
      limit
    });

    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    response.headers.set('Vary', 'Authorization');

    return response;

  } catch (error) {
    console.error('Stores Data API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
