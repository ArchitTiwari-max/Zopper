import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user from token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const resolvedParams = await params;
    const storeId = resolvedParams.id;

    // Get store data with partner brands
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        visits: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Get latest visit for any additional info if needed
        }
      }
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get partner brands for this store
    const partnerBrands = await prisma.brand.findMany({
      where: {
        id: {
          in: store.partnerBrandIds
        }
      }
    });

    // Transform store data
    const transformedStore = {
      id: store.id,
      storeName: store.storeName,
      city: store.city,
      fullAddress: store.fullAddress,
      partnerBrands: partnerBrands.map(brand => brand.brandName)
    };

    return NextResponse.json(transformedStore);

  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json(
      { error: 'Failed to fetch store' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
