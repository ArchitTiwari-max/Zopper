import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check if admin
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

    // Generate ETag for cache validation (10-minute intervals for filter data)
    const currentTime = Math.floor(Date.now() / (10 * 60 * 1000)) * (10 * 60 * 1000);
    const etag = `"${currentTime}-admin-issue-filters"`;
    
    // Check if client has cached version (conditional request)
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { 
        status: 304,
        headers: {
          'Cache-Control': 'private, max-age=600, stale-while-revalidate=300',
          'ETag': etag
        }
      });
    }

    // Get all filter data in parallel for better performance
    const [stores, executives, brands] = await Promise.all([
      // Get all stores
      prisma.store.findMany({
        select: {
          id: true,
          storeName: true,
          city: true
        },
        orderBy: {
          storeName: 'asc'
        }
      }),

      // Get all executives
      prisma.executive.findMany({
        select: {
          id: true,
          name: true,
          region: true
        },
        orderBy: {
          name: 'asc'
        }
      }),

      // Get all brands
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

    // Get unique cities from stores
    const cities = [...new Set(stores.map(store => store.city))].sort();

    // Define status options (all three as per enum IssueStatus)
    const statuses = ['Pending', 'Assigned', 'Resolved'];

    // Format response
    const filterData = {
      stores: stores.map(store => ({
        id: store.id,
        name: store.storeName,
        city: store.city
      })),
      executives: executives.map(executive => ({
        id: executive.id,
        name: executive.name,
        region: executive.region
      })),
      brands: brands.map(brand => ({
        id: brand.id,
        name: brand.brandName
      })),
      cities: cities.filter(Boolean), // Remove any null/undefined cities
      statuses: statuses
    };

    const response = NextResponse.json(filterData);
    
    // Add secure caching headers - longer cache for filter data
    response.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=300');
    response.headers.set('Vary', 'Authorization');
    response.headers.set('ETag', etag);
    
    return response;

  } catch (error) {
    console.error('Issues Filters API Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
