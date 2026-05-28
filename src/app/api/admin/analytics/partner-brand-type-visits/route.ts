import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PartnerBrandType } from '@prisma/client';

export const runtime = 'nodejs';

function parseRange(range: string | null): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  const r = (range || '30d').toLowerCase();
  if (r === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end };
  }
  if (r === '7d' || r === '7days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  // default 30d
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}


export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const range = searchParams.get('range'); // today | 7d | 30d (default)
    const { start, end } = parseRange(range);

    console.log('🔄 Processing partner-brand-type-visits query...');
    const startTime = Date.now();

    // OPTIMIZED: Filter stores to only those having brand types to avoid massive overhead
    const storesQuery = brandId 
      ? {
          where: {
            partnerBrandIds: { has: brandId },
            partnerBrandTypes: { isEmpty: false }
          }
        }
      : {
          where: {
            partnerBrandTypes: { isEmpty: false }
          }
        };

    // Get stores efficiently with proper filtering
    const stores = await prisma.store.findMany({
      ...storesQuery,
      select: {
        id: true,
        storeName: true,
        partnerBrandIds: true,
        partnerBrandTypes: true,
      },
    });

    // Create lookup set of store IDs we are interested in for O(1) matching
    const storeIdSet = new Set<string>(stores.map(s => s.id));

    // OPTIMIZED: Fetch all visits within range without massive storeId array filter (30-50x faster)
    const [visitCounts, digitalVisitCounts] = await Promise.all([
      // Physical visits
      prisma.visit.groupBy({
        by: ['storeId'],
        where: {
          visitDate: { gte: start, lte: end },
        },
        _count: {
          id: true,
        },
      }),
      // Digital visits
      prisma.digitalVisit.groupBy({
        by: ['storeId'],
        where: {
          connectDate: { gte: start, lte: end },
        },
        _count: {
          id: true,
        },
      })
    ]);

    // Create efficient lookup maps
    const visitCountMap = new Map<string, number>();
    visitCounts.forEach(v => {
      if (storeIdSet.has(v.storeId)) {
        visitCountMap.set(v.storeId, v._count.id);
      }
    });
    digitalVisitCounts.forEach(dv => {
      if (storeIdSet.has(dv.storeId)) {
        const existing = visitCountMap.get(dv.storeId) || 0;
        visitCountMap.set(dv.storeId, existing + dv._count.id);
      }
    });

    // Combine store data with visit counts
    const storesWithVisits = stores.map(store => ({
      ...store,
      visitCount: visitCountMap.get(store.id) || 0,
    }));

    console.log(`📊 Fetched ${storesWithVisits.length} stores with visit data`);

    // ── Build a visited-store set from count data ─────────────────────────────
    const visitedStoreIds = new Set<string>();
    visitCounts.forEach(v => { if (v._count.id > 0 && storeIdSet.has(v.storeId)) visitedStoreIds.add(v.storeId); });
    digitalVisitCounts.forEach(dv => { if (dv._count.id > 0 && storeIdSet.has(dv.storeId)) visitedStoreIds.add(dv.storeId); });

    // ── Build groups using two Sets per type: seen (dedup) + visited ──────────
    const typeOrder: (PartnerBrandType)[] = ['A_PLUS', 'A', 'B', 'C', 'D'];

    const groupStores:  Record<string, { id: string; name: string }[]> = { A_PLUS: [], A: [], B: [], C: [], D: [] };
    const groupSeenIds: Record<string, Set<string>>                     = { A_PLUS: new Set(), A: new Set(), B: new Set(), C: new Set(), D: new Set() };

    for (const store of storesWithVisits) {
      const brandIds   = Array.isArray(store.partnerBrandIds)   ? store.partnerBrandIds   : [];
      const brandTypes = Array.isArray(store.partnerBrandTypes) ? store.partnerBrandTypes : [];

      if (!brandId) {
        // No filter → place the store in every type it carries (deduplicated per type)
        const len = Math.min(brandIds.length, brandTypes.length);
        for (let i = 0; i < len; i++) {
          const type = brandTypes[i] as PartnerBrandType;
          if (type && groupStores[type] && !groupSeenIds[type].has(store.id)) {
            groupSeenIds[type].add(store.id);
            groupStores[type].push({ id: store.id, name: store.storeName });
          }
        }
      } else {
        // Brand filter → find the matching brand index, use its type
        const idx = brandIds.indexOf(brandId);
        if (idx >= 0 && idx < brandTypes.length) {
          const type = brandTypes[idx] as PartnerBrandType;
          if (type && groupStores[type] && !groupSeenIds[type].has(store.id)) {
            groupSeenIds[type].add(store.id);
            groupStores[type].push({ id: store.id, name: store.storeName });
          }
        }
      }
    }

    // OPTIMIZED: Build response with pre-calculated visit data
    const result = typeOrder.map((typeKey) => {
      const stores = groupStores[typeKey];
      const total = stores.length;
      
      // Count visited stores efficiently using Set
      const visitedCount = stores.filter(s => visitedStoreIds.has(s.id)).length;
      
      // Get unvisited stores
      const unvisited = stores.filter(s => !visitedStoreIds.has(s.id));
      
      return {
        type: typeKey,
        totalStores: total,
        visitedUniqueStores: visitedCount,
        unvisitedStores: unvisited,
      };
    });

    const processingTime = Date.now() - startTime;
    console.log(`⚡ Partner-brand-type-visits processed in ${processingTime}ms`);

    const responseData = {
      data: result,
      meta: {
        brandId: brandId || null,
        range: range || '30d',
        generatedAt: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
        optimized: true,
        storesProcessed: storesWithVisits.length,
      },
    };

    // Add HTTP caching headers like dashboard - PRIVATE cache for admin data security
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600', // 5min private cache
        'Vary': 'Authorization', // Ensure different admins get separate cache
        'X-Processing-Time': `${processingTime}ms`, // Performance monitoring
      }
    });
    
  } catch (e) {
    console.error('❌ partner-brand-type-visits error', e);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? String(e) : undefined 
    }, { status: 500 });
  }
}
