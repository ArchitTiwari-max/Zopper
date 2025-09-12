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

    // OPTIMIZED: Get all filter data concurrently with Promise.all - no limits, fetch all data
    const [executives, stores, brands] = await Promise.all([
      // Get ALL executives for executive names - no limits
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

      // Get ALL stores for store names - no limits
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

      // Get ALL brands - no limits
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
    const cities = [...new Set(stores.map(store => store.city).filter(Boolean))].sort();

    return NextResponse.json({
      executives: executives.map(exec => ({ id: exec.id, name: exec.name, region: exec.region })),
      stores: stores.map(store => ({ id: store.id, name: store.storeName, city: store.city })),
      brands: brands.map(brand => ({ id: brand.id, name: brand.brandName })),
      cities: cities
    });

  } catch (error) {
    console.error('Executives Filters API Error:', error);
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
