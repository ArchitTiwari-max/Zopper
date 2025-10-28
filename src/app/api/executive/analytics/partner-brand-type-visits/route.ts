import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { PartnerBrandType } from '@prisma/client';

function parseRange(range: string | null): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  const r = (range || '30d').toLowerCase();
  if (r === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end };
  }
  if (r === '7d' || r === '7days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  // default 30d
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Executive access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const range = searchParams.get('range'); // today | 7d | 30d (default)
    const { start, end } = parseRange(range);

    // Resolve executive and assigned store IDs
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { id: true, executiveStores: { select: { storeId: true } } },
    });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const assignedStoreIds = executive.executiveStores.map(es => es.storeId);
    if (assignedStoreIds.length === 0) {
      const empty: Array<{ type: PartnerBrandType; totalStores: number; visitedUniqueStores: number; unvisitedStores: any[] }> = [] as any;
      return NextResponse.json({ data: [
        { type: 'A_PLUS', totalStores: 0, visitedUniqueStores: 0, unvisitedStores: [] },
        { type: 'A', totalStores: 0, visitedUniqueStores: 0, unvisitedStores: [] },
        { type: 'B', totalStores: 0, visitedUniqueStores: 0, unvisitedStores: [] },
        { type: 'C', totalStores: 0, visitedUniqueStores: 0, unvisitedStores: [] },
        { type: 'D', totalStores: 0, visitedUniqueStores: 0, unvisitedStores: [] },
      ], meta: { brandId: brandId || null, range: range || '30d', generatedAt: new Date().toISOString() } });
    }

    // Fetch only assigned stores
    const stores = await prisma.store.findMany({
      where: { id: { in: assignedStoreIds } },
      select: { id: true, storeName: true, partnerBrandIds: true, partnerBrandTypes: true },
    });

    // Build groups by partner brand type for the selected brand
    const groups: Record<PartnerBrandType, { stores: { id: string; name: string }[] }> = {
      A_PLUS: { stores: [] },
      A: { stores: [] },
      B: { stores: [] },
      C: { stores: [] },
      D: { stores: [] },
    };

    for (const s of stores) {
      if (!brandId) {
        if (Array.isArray(s.partnerBrandIds) && Array.isArray(s.partnerBrandTypes)) {
          const len = Math.min(s.partnerBrandIds.length, s.partnerBrandTypes.length);
          for (let i = 0; i < len; i++) {
            const t = s.partnerBrandTypes[i] as PartnerBrandType | undefined;
            if (t && groups[t]) {
              if (!groups[t].stores.some((st) => st.id === s.id)) {
                groups[t].stores.push({ id: s.id, name: s.storeName });
              }
            }
          }
        }
      } else {
        const idx = s.partnerBrandIds.indexOf(brandId);
        if (idx >= 0 && Array.isArray(s.partnerBrandTypes) && s.partnerBrandTypes[idx]) {
          const t = s.partnerBrandTypes[idx] as PartnerBrandType;
          if (!groups[t].stores.some((st) => st.id === s.id)) {
            groups[t].stores.push({ id: s.id, name: s.storeName });
          }
        }
      }
    }

    // Fetch visits for these stores in the date range (both physical and digital),
    // but only those by this executive for fairness on exec dashboard
    const allStoreIds = Array.from(new Set(Object.values(groups).flatMap((g) => g.stores.map((s) => s.id))));

    let visitedStoreIds = new Set<string>();
    if (allStoreIds.length > 0) {
      const [visits, dVisits] = await Promise.all([
        prisma.visit.findMany({
          where: {
            storeId: { in: allStoreIds },
            executiveId: executive.id,
            createdAt: { gte: start, lte: end },
          },
          select: { storeId: true },
        }),
        prisma.digitalVisit.findMany({
          where: {
            storeId: { in: allStoreIds },
            executiveId: executive.id,
            connectDate: { gte: start, lte: end },
          },
          select: { storeId: true },
        }),
      ]);
      visitedStoreIds = new Set<string>([...visits, ...dVisits].map((v: any) => v.storeId));
    }

    type TypeKey = keyof typeof groups;
    const typeOrder: TypeKey[] = ['A_PLUS', 'A', 'B', 'C', 'D'];
    const result = typeOrder.map((typeKey) => {
      const stores = groups[typeKey].stores;
      const total = stores.length;
      const visitedUnique = stores.filter((s) => visitedStoreIds.has(s.id)).length;
      const unvisited = stores.filter((s) => !visitedStoreIds.has(s.id));
      return {
        type: typeKey,
        totalStores: total,
        visitedUniqueStores: visitedUnique,
        unvisitedStores: unvisited,
      };
    });

    return NextResponse.json({
      data: result,
      meta: {
        brandId: brandId || null,
        range: range || '30d',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('exec partner-brand-type-visits error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
