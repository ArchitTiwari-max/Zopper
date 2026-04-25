import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractChainPrefix } from '@/lib/chainConfig';

export const runtime = 'nodejs';

/**
 * GET: Fetch all chain configs + auto-detect chains from store names.
 * Returns:
 *   - All configured chains with their matched stores
 *   - Auto-detected chains (prefixes found in stores but not yet configured)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all stores and all existing chain configs in parallel
    const [stores, chainConfigs] = await Promise.all([
      prisma.store.findMany({
        select: { id: true, storeName: true, city: true }
      }),
      prisma.storeChainConfig.findMany({
        orderBy: { chainName: 'asc' }
      })
    ]);

    // Build a set of configured prefixes
    const configuredPrefixes = new Set(chainConfigs.map(c => c.prefix.toUpperCase()));

    // Auto-detect chains from store names
    const prefixMap = new Map<string, typeof stores>();
    for (const store of stores) {
      const prefix = extractChainPrefix(store.storeName);
      if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
      prefixMap.get(prefix)!.push(store);
    }

    // CONSOLIDATE MINOR CHAINS INTO "LOCAL"
    const localStores: typeof stores = [];
    const prefixes = Array.from(prefixMap.keys());
    for (const prefix of prefixes) {
      if (prefix === 'LOCAL' || configuredPrefixes.has(prefix)) continue;
      const storesForPrefix = prefixMap.get(prefix)!;
      if (storesForPrefix.length <= 35) {
         localStores.push(...storesForPrefix);
         prefixMap.delete(prefix);
      }
    }
    
    if (localStores.length > 0) {
      if (!prefixMap.has('LOCAL')) {
         prefixMap.set('LOCAL', []);
      }
      prefixMap.get('LOCAL')!.push(...localStores);
    }

    // Build the response: configured chains with their stores
    const configuredChains = chainConfigs.map(config => {
      const prefix = config.prefix.toUpperCase();
      const matchedStores = (prefixMap.get(prefix) || []).filter(
        s => !config.excludedStoreIds.includes(s.id)
      );
      const excludedStores = (prefixMap.get(prefix) || []).filter(
        s => config.excludedStoreIds.includes(s.id)
      );

      return {
        id: config.id,
        chainName: config.chainName,
        prefix: config.prefix,
        excludedStoreIds: config.excludedStoreIds,
        storeRoles: config.storeRoles,
        stakeholderRoles: config.stakeholderRoles,
        matchedStores,
        excludedStores,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    });

    // Auto-detected unconfigured chains
    const unconfiguredChains: { prefix: string; stores: typeof stores }[] = [];
    for (const [prefix, prefixStores] of prefixMap.entries()) {
      if (!configuredPrefixes.has(prefix)) {
        unconfiguredChains.push({ prefix, stores: prefixStores });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        configuredChains,
        unconfiguredChains,
      }
    });

  } catch (error) {
    console.error('Error fetching chain configs:', error);
    return NextResponse.json({ error: 'Failed to fetch chain configs' }, { status: 500 });
  }
}

/**
 * POST: Create a new chain config (admin initializes a chain from unconfigured or scratch)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chainName, prefix, storeRoles = [], stakeholderRoles = [] } = body;

    if (!chainName || !prefix) {
      return NextResponse.json(
        { error: 'chainName and prefix are required' },
        { status: 400 }
      );
    }

    const config = await prisma.storeChainConfig.create({
      data: {
        chainName: chainName.toUpperCase(),
        prefix: prefix.toUpperCase(),
        excludedStoreIds: [],
        storeRoles,
        stakeholderRoles,
      }
    });

    return NextResponse.json({ success: true, data: config });

  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A chain with this name or prefix already exists' },
        { status: 409 }
      );
    }
    console.error('Error creating chain config:', error);
    return NextResponse.json({ error: 'Failed to create chain config' }, { status: 500 });
  }
}
