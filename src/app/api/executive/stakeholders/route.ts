import { NextRequest, NextResponse } from 'next/server';
import { prisma, withReconnect } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET — fetch all active stakeholders for executive to choose from
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await withReconnect(async () => {
      const stakeholders = await prisma.stakeholder.findMany({
        where: { isActive: true },
        orderBy: { designation: 'asc' },
        select: { id: true, designation: true, brands: true },
      });

      const executive = await prisma.employee.findUnique({
        where: { userId: user.userId },
        select: { employeeStores: { select: { storeId: true } } }
      });

      let brands: any[] = [];
      let states: string[] = [];
      if (executive) {
        const storeIds = executive.employeeStores.map(es => es.storeId);
        const stores = await prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: {
            state: true,
            storeBrands: { select: { brandId: true } }
          }
        });
        const assignedBrandIds = new Set<string>();
        const stateSet = new Set<string>();
        for (const store of stores) {
          if (store.state) stateSet.add(store.state);
          for (const sb of store.storeBrands) assignedBrandIds.add(sb.brandId);
        }
        states = Array.from(stateSet);
        brands = await prisma.brand.findMany({
          where: { id: { in: Array.from(assignedBrandIds) } },
          select: { id: true, brandName: true },
          orderBy: { brandName: 'asc' }
        });
      }
      return { stakeholders, brands, states };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Stakeholders fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
