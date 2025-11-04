import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive data
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      include: {
        executiveStores: {
          select: {
            storeId: true
          }
        }
      }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Disable caching for My Visits filters to always get the latest options

    // Get comprehensive filter data in parallel
    const [assignedStores, allBrands] = await Promise.all([
      // Get all stores assigned to this executive for city filtering
      prisma.store.findMany({
        where: {
          id: {
            in: executive.executiveStores.map(es => es.storeId)
          }
        },
        select: {
          id: true,
          storeName: true,
          city: true,
          partnerBrandIds: true
        }
      }),
      
      // Get ALL brands from the system (not just used in visits)
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true,
          // category field removed - using CategoryBrand relation
        },
        orderBy: {
          brandName: 'asc'
        }
      })
    ]);

    // Get all unique cities from assigned stores
    const allCities = Array.from(new Set(assignedStores.map(store => store.city))).sort();
    const cities = ['All Cities', ...allCities];

    // Get all brands (regardless of whether they're used in visits or stores)
    const allBrandNames = allBrands.map(brand => brand.brandName).sort();
    const brands = ['All Brands', ...allBrandNames];

    // Get brands currently used by assigned stores
    const usedBrandIds = new Set(assignedStores.flatMap(store => store.partnerBrandIds));
    const usedBrands = allBrands
      .filter(brand => usedBrandIds.has(brand.id))
      .map(brand => brand.brandName)
      .sort();
    const currentlyUsedBrands = ['All Brands', ...usedBrands];

    // Get brand categories for advanced filtering
    const categories = Array.from(new Set(
      allBrands
        .map(brand => 'General') // TODO: Implement category lookup via CategoryBrand relation
        .filter(category => category && category.trim() !== '')
    )).sort();
    const brandCategories = ['All Categories', ...categories];

    // Visit status options
    const statuses = [
      'All Status',
      'PENDING_REVIEW',
      'REVIEWD'
    ];

    // Sort options for visits
    const sortOptions = [
      'Recent First',
      'Store Name A-Z',
      'Store Name Z-A',
      'Status',
      'Oldest First'
    ];

    // Period options for date filtering
    const periodOptions = [
      'Today',
      'Last 7 Days',
      'Last 30 Days',
      'Last 90 Days',
      'This Month',
      'Last Month'
    ];

    // Create response with comprehensive filter data
    const response = NextResponse.json({
      success: true,
      data: {
        filterOptions: {
          // Basic filters
          cities,
          brands,
          statuses,
          sortOptions,
          periodOptions,
          
          // Advanced filters
          currentlyUsedBrands, // Only brands actually used by assigned stores
          brandCategories,     // Categories for brand grouping
          
          // Additional metadata
          totalStores: assignedStores.length,
          totalCities: allCities.length,
          totalBrands: allBrands.length,
          totalUsedBrands: usedBrands.length
        },
        metadata: {
          executiveId: executive.id,
          assignedStoresCount: executive.executiveStores.length,
          generatedAt: new Date().toISOString(),
          cacheExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        }
      }
    });

    // Disable caching completely so changes reflect instantly
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie');

    // Minimal security header
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;

  } catch (error) {
    console.error('Error fetching visit filter data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visit filter data' },
      { status: 500 }
    );
  }
}
