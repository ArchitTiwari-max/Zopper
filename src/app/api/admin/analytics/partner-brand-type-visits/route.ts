import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PartnerBrandType } from '@prisma/client';

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

    // OPTIMIZED: Single query with proper WHERE clause instead of loading all stores
    const storeWhereClause = brandId 
      ? { partnerBrandIds: { has: brandId } }
      : {};

    // OPTIMIZED: Use Prisma's findMany with efficient joins instead of raw SQL for better compatibility
    const storesQuery = brandId 
      ? {
          where: {
            partnerBrandIds: { has: brandId }
          }
        }
      : {};

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

    // Get visit counts for all relevant stores in parallel
    const storeIds = stores.map(s => s.id);
    const [visitCounts, digitalVisitCounts] = storeIds.length > 0 ? await Promise.all([
      // Physical visits
      prisma.visit.groupBy({
        by: ['storeId'],
        where: {
          storeId: { in: storeIds },
          createdAt: { gte: start, lte: end },
        },
        _count: {
          id: true,
        },
      }),
      // Digital visits
      prisma.digitalVisit.groupBy({
        by: ['storeId'],
        where: {
          storeId: { in: storeIds },
          connectDate: { gte: start, lte: end },
        },
        _count: {
          id: true,
        },
      })
    ]) : [[], []];

    // Create efficient lookup maps
    const visitCountMap = new Map<string, number>();
    visitCounts.forEach(v => {
      visitCountMap.set(v.storeId, v._count.id);
    });
    digitalVisitCounts.forEach(dv => {
      const existing = visitCountMap.get(dv.storeId) || 0;
      visitCountMap.set(dv.storeId, existing + dv._count.id);
    });

    // Combine store data with visit counts
    const storesWithVisits = stores.map(store => ({
      ...store,
      visitCount: visitCountMap.get(store.id) || 0,
    }));

    console.log(`📊 Fetched ${storesWithVisits.length} stores with visit data`);

    // OPTIMIZED: Build groups with O(n) complexity instead of O(n²)
    const groups: Record<PartnerBrandType, { 
      stores: { id: string; name: string }[]; 
      visitedStores: Set<string>;
    }> = {
      A_PLUS: { stores: [], visitedStores: new Set() },
      A: { stores: [], visitedStores: new Set() },
      B: { stores: [], visitedStores: new Set() },
      C: { stores: [], visitedStores: new Set() },
      D: { stores: [], visitedStores: new Set() },
    };

    // OPTIMIZED: Single pass through stores with efficient mapping
    for (const store of storesWithVisits) {
      const hasVisits = store.visitCount > 0;
      
      if (!brandId) {
        // If no brandId filter, include store once per type it has
        const brandIds = Array.isArray(store.partnerBrandIds) ? store.partnerBrandIds : [];
        const brandTypes = Array.isArray(store.partnerBrandTypes) ? store.partnerBrandTypes : [];
        
        const len = Math.min(brandIds.length, brandTypes.length);
        for (let i = 0; i < len; i++) {
          const type = brandTypes[i] as PartnerBrandType;
          if (type && groups[type]) {
            // Use Set for O(1) duplicate checking instead of array.some()
            const storeKey = store.id;
            if (!groups[type].visitedStores.has(storeKey)) {
              groups[type].stores.push({ id: store.id, name: store.storeName });
              groups[type].visitedStores.add(storeKey);
              if (hasVisits) {
                groups[type].visitedStores.add(`visited:${storeKey}`);
              }
            }
          }
        }
      } else {
        // With brand filter: find index of brandId and map to single type
        const brandIds = Array.isArray(store.partnerBrandIds) ? store.partnerBrandIds : [];
        const brandTypes = Array.isArray(store.partnerBrandTypes) ? store.partnerBrandTypes : [];
        
        const idx = brandIds.indexOf(brandId);
        if (idx >= 0 && idx < brandTypes.length) {
          const type = brandTypes[idx] as PartnerBrandType;
          if (type && groups[type]) {
            const storeKey = store.id;
            if (!groups[type].visitedStores.has(storeKey)) {
              groups[type].stores.push({ id: store.id, name: store.storeName });
              groups[type].visitedStores.add(storeKey);
              if (hasVisits) {
                groups[type].visitedStores.add(`visited:${storeKey}`);
              }
            }
          }
        }
      }
    }

    // OPTIMIZED: Build response with pre-calculated visit data
    const typeOrder: (keyof typeof groups)[] = ['A_PLUS', 'A', 'B', 'C', 'D'];
    const result = typeOrder.map((typeKey) => {
      const group = groups[typeKey];
      const stores = group.stores;
      const total = stores.length;
      
      // Count visited stores efficiently using Set
      const visitedCount = stores.filter(s => 
        group.visitedStores.has(`visited:${s.id}`)
      ).length;
      
      // Get unvisited stores
      const unvisited = stores.filter(s => 
        !group.visitedStores.has(`visited:${s.id}`)
      );
      
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
