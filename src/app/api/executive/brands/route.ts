import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user || user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Unauthorized: Executive access required' }, { status: 401 });
    }

    // Get executive profile to resolve assigned stores
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: {
        executiveStores: {
          select: {
            store: {
              select: {
                partnerBrandIds: true
              }
            }
          }
        }
      }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Extract all unique brand IDs from the executive's assigned stores
    const assignedBrandIds = new Set<string>();
    for (const assignment of executive.executiveStores) {
      const storeBrandIds = assignment.store.partnerBrandIds;
      if (Array.isArray(storeBrandIds)) {
        for (const brandId of storeBrandIds) {
          if (typeof brandId === 'string') {
            assignedBrandIds.add(brandId);
          }
        }
      }
    }

    // Fetch only the brands that belong to the assigned stores
    const brands = await prisma.brand.findMany({
      where: {
        id: {
          in: Array.from(assignedBrandIds)
        }
      },
      select: {
        id: true,
        brandName: true,
      },
      orderBy: {
        brandName: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: brands
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Vary': 'Cookie'
      }
    });

  } catch (error) {
    console.error('Fetch brands error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}
