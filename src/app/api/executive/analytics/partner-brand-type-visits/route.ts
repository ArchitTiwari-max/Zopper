import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PartnerBrandType } from '@prisma/client';

export const runtime = 'nodejs';

function parseRange(range: string | null): { start: Date; end: Date } {
  const now = new Date();
  const r = (range || '30d').toLowerCase();
  if (r === 'today') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
  }
  if (r === '7d' || r === '7days') {
    return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
  }
  return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const EMPTY_RESULT = ['A_PLUS', 'A', 'B', 'C', 'D'].map(type => ({
  type, totalStores: 0, visitedUniqueStores: 0, unvisitedStores: []
}));

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Executive access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const brandId   = searchParams.get('brandId');
    const range     = searchParams.get('range');
    const { start, end } = parseRange(range);

    // ── 1) Resolve executive + assigned store IDs ────────────────────────────
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { id: true, executiveStores: { select: { storeId: true } } },
    });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const assignedStoreIds = executive.executiveStores.map(es => es.storeId);
    if (assignedStoreIds.length === 0) {
      return NextResponse.json({ data: EMPTY_RESULT, meta: { brandId: brandId || null, range: range || '30d', generatedAt: new Date().toISOString() } });
    }

    const CHUNK = 500;
    const storeChunks = chunk(assignedStoreIds, CHUNK);

    // ── 2) Fetch stores + visits IN PARALLEL ─────────────────────────────────
    const [storesNested, visitsNested, dVisitsNested] = await Promise.all([
      Promise.all(storeChunks.map(ids =>
        prisma.store.findMany({
          where: { id: { in: ids } },
          select: { id: true, storeName: true, partnerBrandIds: true, partnerBrandTypes: true },
        })
      )),
      Promise.all(storeChunks.map(ids =>
        prisma.visit.findMany({
          where: { storeId: { in: ids }, executiveId: executive.id, visitDate: { gte: start, lte: end } },
          select: { storeId: true },
        })
      )),
      Promise.all(storeChunks.map(ids =>
        prisma.digitalVisit.findMany({
          where: { storeId: { in: ids }, executiveId: executive.id, connectDate: { gte: start, lte: end } },
          select: { storeId: true },
        })
      )),
    ]);

    const stores   = storesNested.flat();
    const allVisits = [...visitsNested.flat(), ...dVisitsNested.flat()];

    // ── 3) Build O(1) visited-store set ──────────────────────────────────────
    const visitedStoreIds = new Set<string>(allVisits.map(v => v.storeId));

    // ── 4) Build groups using Maps (no Array.some dedup — use a Set) ─────────
    const typeOrder: PartnerBrandType[] = ['A_PLUS', 'A', 'B', 'C', 'D'];
    // storeType -> Set of store IDs already added (for dedup)
    const groupSets: Record<string, Set<string>> = { A_PLUS: new Set(), A: new Set(), B: new Set(), C: new Set(), D: new Set() };
    // storeType -> Array of { id, name }
    const groups: Record<string, { id: string; name: string }[]> = { A_PLUS: [], A: [], B: [], C: [], D: [] };

    for (const s of stores) {
      if (!brandId) {
        if (Array.isArray(s.partnerBrandIds) && Array.isArray(s.partnerBrandTypes)) {
          const len = Math.min(s.partnerBrandIds.length, s.partnerBrandTypes.length);
          for (let i = 0; i < len; i++) {
            const t = s.partnerBrandTypes[i] as PartnerBrandType;
            if (t && groups[t] && !groupSets[t].has(s.id)) {
              groupSets[t].add(s.id);
              groups[t].push({ id: s.id, name: s.storeName });
            }
          }
        }
      } else {
        const idx = s.partnerBrandIds.indexOf(brandId);
        if (idx >= 0 && Array.isArray(s.partnerBrandTypes) && s.partnerBrandTypes[idx]) {
          const t = s.partnerBrandTypes[idx] as PartnerBrandType;
          if (groups[t] && !groupSets[t].has(s.id)) {
            groupSets[t].add(s.id);
            groups[t].push({ id: s.id, name: s.storeName });
          }
        }
      }
    }

    // ── 5) Build result ───────────────────────────────────────────────────────
    const result = typeOrder.map(typeKey => {
      const typeStores   = groups[typeKey];
      const visited      = typeStores.filter(s => visitedStoreIds.has(s.id)).length;
      const unvisited    = typeStores.filter(s => !visitedStoreIds.has(s.id));
      return { type: typeKey, totalStores: typeStores.length, visitedUniqueStores: visited, unvisitedStores: unvisited };
    });

    return NextResponse.json({
      data: result,
      meta: { brandId: brandId || null, range: range || '30d', generatedAt: new Date().toISOString() }
    }, {
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Vary': 'Cookie'
      }
    });

  } catch (e) {
    console.error('exec partner-brand-type-visits error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
