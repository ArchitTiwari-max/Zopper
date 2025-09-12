import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Get executive data using userId from token
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      include: {
        user: true
      }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Generate ETag for cache validation (1-minute intervals)
    const currentTime = Math.floor(Date.now() / (1 * 60 * 1000)) * (1 * 60 * 1000);
    const etag = `"${currentTime}-${executive.id}"`;
    
    // Check if client has cached version (conditional request)
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      // Return 304 Not Modified if ETag matches
      return new NextResponse(null, { 
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60',
          'ETag': etag
        }
      });
    }

    // Get all stores and all brands in parallel to avoid N+1 queries
    const [stores, allBrands] = await Promise.all([
      // Get all stores assigned to this executive
      prisma.store.findMany({
        where: {
          id: {
            in: executive.assignedStoreIds
          }
        },
        include: {
          visits: {
            where: {
              executiveId: executive.id
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 1 // Get only the most recent visit
          }
        }
      }),
      
      // Get all brands that might be used by these stores (single query)
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true
        }
      })
    ]);

    // Create a Map for fast brand lookups
    const brandMap = new Map(allBrands.map(brand => [brand.id, brand]));

    // Transform the data (now synchronous - no more database queries in loop)
    const transformedStores = stores.map((store) => {
      // Get partner brands for this store from the brandMap
      const partnerBrands = store.partnerBrandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean) // Remove undefined brands
        .map(brand => brand!.brandName);

      // Calculate visit status dynamically
      let visitStatus = 'No visit';
      let lastVisitDate = null;
      
      if (store.visits.length > 0) {
        const lastVisit = store.visits[0];
        lastVisitDate = lastVisit.createdAt;
        const now = new Date();
        const visitDate = new Date(lastVisit.createdAt);
        
        // Calculate difference in days
        const diffTime = Math.abs(now.getTime() - visitDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          visitStatus = 'Today';
        } else if (diffDays === 1) {
          visitStatus = '1 day ago';
        } else {
          visitStatus = `${diffDays} days ago`;
        }
      }

      return {
        id: store.id,
        storeName: store.storeName,
        city: store.city,
        fullAddress: store.fullAddress,
        partnerBrands: partnerBrands,
        visited: visitStatus,
        lastVisitDate: lastVisitDate,
        // For sorting purposes - stores with no visits go to the end
        sortOrder: lastVisitDate ? new Date(lastVisitDate).getTime() : 0
      };
    });

    // Sort by recently visited first (stores with recent visits first, then no visits)
    transformedStores.sort((a, b) => {
      if (a.sortOrder === 0 && b.sortOrder === 0) return 0; // Both have no visits
      if (a.sortOrder === 0) return 1; // a has no visits, goes to end
      if (b.sortOrder === 0) return -1; // b has no visits, goes to end
      return b.sortOrder - a.sortOrder; // Most recent first
    });

    // Get unique cities from the stores
    const cities = ['All Cities', ...Array.from(new Set(stores.map(store => store.city)))];
    
    // Get all unique brands from all stores for filtering
    const allStoreBrands = transformedStores.flatMap(store => store.partnerBrands);
    const uniqueBrands = ['All Brands', ...Array.from(new Set(allStoreBrands))];
    const brands = uniqueBrands;

    // Create response with cache headers for maximum performance
    const response = NextResponse.json({
      success: true,
      data: {
        stores: transformedStores,
        filterOptions: {
          cities,
          brands,
          sortOptions: [
            'Recently Visited First',
            'Store Name A-Z', 
            'Store Name Z-A', 
            'City A-Z'
          ]
        },
        executive: {
          id: executive.id,
          name: executive.name,
          region: executive.region
        }
      }
    });

    // Add caching headers - cache for 1 minute
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    response.headers.set('CDN-Cache-Control', 'public, max-age=60');
    response.headers.set('Vary', 'User-Agent');
    
    // Add ETag for cache validation
    response.headers.set('ETag', etag);
    
    return response;

  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
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
