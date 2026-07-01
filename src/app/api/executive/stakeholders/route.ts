import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET — fetch all active stakeholders for executive to choose from
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const stakeholders = await prisma.stakeholder.findMany({
      where: { 
        isActive: true,
      },
      orderBy: { designation: 'asc' },
      select: {
        id: true,
        designation: true,
        brands: true,
      },
    });

    // Fetch executive's assigned brands
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: {
        executiveStores: {
          select: { storeId: true }
        }
      }
    });

    let brands: any[] = [];
    if (executive) {
      const storeIds = executive.executiveStores.map(es => es.storeId);
      const stores = await prisma.store.findMany({
        where: { id: { in: storeIds } },
        select: { storeBrands: { select: { brandId: true } } }
      });
      const assignedBrandIds = new Set<string>();
      for (const store of stores) {
        for (const sb of store.storeBrands) {
          assignedBrandIds.add(sb.brandId);
        }
      }
      brands = await prisma.brand.findMany({
        where: { id: { in: Array.from(assignedBrandIds) } },
        select: { id: true, brandName: true },
        orderBy: { brandName: 'asc' }
      });
    }

    return NextResponse.json({ success: true, stakeholders, brands });
  } catch (error) {
    console.error('Stakeholders fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
