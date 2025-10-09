import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PartnerBrandType } from '@prisma/client';

// In-memory cache for performance (in production, use Redis)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// Helper function to get cached data
function getCachedData(cacheKey: string) {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

// Helper function to set cached data
function setCachedData(cacheKey: string, data: any) {
  cache.set(cacheKey, { data, timestamp: Date.now() });
  
  // Clean up old cache entries (prevent memory leaks)
  if (cache.size > 100) {
    const oldestKeys = Array.from(cache.keys()).slice(0, 50);
    oldestKeys.forEach(key => cache.delete(key));
  }
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

    // Create cache key for this specific request
    const cacheKey = `partner-brand-visits:${brandId || 'all'}:${range}:${start.getTime()}-${end.getTime()}`;
    
    // Check cache first
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      console.log('🚀 Cache hit for partner-brand-type-visits');
      return NextResponse.json({
        ...cachedResult,
        meta: {
          ...cachedResult.meta,
          fromCache: true,
        }
      });
    }

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

    const response = {
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

    // Cache the result for future requests
    setCachedData(cacheKey, response);

    return NextResponse.json(response);
    
  } catch (e) {
    console.error('❌ partner-brand-type-visits error', e);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? String(e) : undefined 
    }, { status: 500 });
  }
}
