import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Run mostly parallel, except cities depend on unique values from stores later
    // Optimizing by fetching only name and id
    const [storesRaw, admins, brands] = await Promise.all([
      prisma.store.findMany({
        select: {
          id: true,
          storeName: true,
          city: true
        },
        orderBy: {
          storeName: 'asc'
        } // Sort in DB if possible, but we'll still sort below because of distinct nature
      }),
      prisma.admin.findMany({
        select: {
          id: true,
          name: true,
          region: true
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true
        },
        orderBy: {
          brandName: 'asc'
        }
      })
    ]);

    // Optimize deduplication of stores and extraction of cities
    const storeMap = new Map();
    const citySet = new Set<string>();

    for (const store of storesRaw) {
      // Store deduplication based on storeName
      if (!storeMap.has(store.storeName)) {
        storeMap.set(store.storeName, {
          id: store.id,
          name: store.storeName,
          city: store.city || 'Unknown'
        });
      }

      // Collect unique cities
      if (store.city) {
        citySet.add(store.city);
      }
    }

    const uniqueStores = Array.from(storeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const uniqueCities = Array.from(citySet).sort();

    // The frontend filters expect the array of admins to be mapped to 'executives' key
    const formattedAdmins = admins.map(exec => ({
      id: exec.id,
      name: exec.name,
      region: exec.region || 'Unknown'
    }));

    const formattedBrands = brands.map(brand => ({
      id: brand.id,
      name: brand.brandName
    }));

    const response = NextResponse.json({
      stores: uniqueStores,
      executives: formattedAdmins, // mapped to executives for UI consistency
      brands: formattedBrands,
      cities: uniqueCities
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=59');

    return response;

  } catch (error) {
    console.error('Filter API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
