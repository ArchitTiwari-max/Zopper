import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      cities: cities.filter(Boolean) // Remove any null/undefined cities
    };

    return NextResponse.json(filterData);

  } catch (error) {
    console.error('Visit Report Filters API Error:', error);
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
