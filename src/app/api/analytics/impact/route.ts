import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { PartnerBrandType, IssueStatus, Role } from '@prisma/client';

type BrandKey = 'A' | 'A+' | 'B' | 'C' | 'D';

const brandToEnum = (b: BrandKey): PartnerBrandType | null => {
  if (b === 'A+') return PartnerBrandType.A_PLUS;
  if (b === 'A') return PartnerBrandType.A;
  if (b === 'B') return PartnerBrandType.B;
  if (b === 'C') return PartnerBrandType.C;
  if (b === 'D') return PartnerBrandType.D;
  return null;
};

// Windows in days for before/after, per requirement
const brandWindows: Record<BrandKey, { before: number; after: number }> = {
  'A': { before: 7, after: 7 },
  'A+': { before: 3, after: 3 },
  // Per prompt: B is only past 15 days; we set after=0
  'B': { before: 15, after: 0 },
  // UI also uses C; we provide a symmetric 15-day window
  'C': { before: 15, after: 15 },
  'D': { before: 30, after: 30 },
};

function fmtDate(d: Date): string {
  // DD-MM-YYYY
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${m}-${y}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const brandParam = (searchParams.get('brand') || 'A') as BrandKey;
    const brandEnum = brandToEnum(brandParam) as PartnerBrandType | null;
    if (!brandEnum) return NextResponse.json({ error: 'Invalid brand' }, { status: 400 });

    // Optional: admin can scope by executiveId
    const scopeExecutiveId = searchParams.get('executiveId');

    // 1) Determine candidate stores based on role and brand type
    //    - Admin: stores that include the brand type (optionally restricted to an executive's assigned stores)
    //    - Executive: only assigned stores that include the brand type
    let allowedStoreIds: string[] | null = null;

    if (user.role === 'EXECUTIVE') {
      const exec = await prisma.executive.findUnique({
        where: { userId: user.userId },
        select: { id: true, executiveStores: { select: { storeId: true } } },
      });
      if (!exec) return NextResponse.json({ data: [], summary: null });
      allowedStoreIds = exec.executiveStores.map(es => es.storeId);
    } else if (user.role === 'ADMIN' && scopeExecutiveId) {
      // Restrict to a specific executive's assigned stores if provided
      const exec = await prisma.executive.findUnique({
        where: { id: scopeExecutiveId },
        select: { executiveStores: { select: { storeId: true } } },
      });
      allowedStoreIds = exec?.executiveStores.map(es => es.storeId) || [];
    }

    const storeWhere: any = {
      ...(allowedStoreIds ? { id: { in: allowedStoreIds } } : {}),
    };

    const stores = await prisma.store.findMany({
      where: storeWhere,
      select: {
        id: true,
        storeName: true,
        city: true,
        partnerBrandIds: true,
        partnerBrandTypes: true,
      },
    });

    // Filter stores by the chosen brand type and map brandIds relevant for that type per store
    const candidate = stores
      .map(s => {
        const ids = s.partnerBrandIds || [];
        const types = (s.partnerBrandTypes || []) as PartnerBrandType[];
        const typeBrandIds: string[] = [];
        const len = Math.min(ids.length, types.length);
        for (let i = 0; i < len; i++) {
          if (types[i] === brandEnum) typeBrandIds.push(ids[i]);
        }
        return typeBrandIds.length > 0 ? { ...s, typeBrandIds } : null;
      })
      .filter(Boolean) as Array<{
        id: string;
        storeName: string;
        city: string | null;
        partnerBrandIds: string[];
        partnerBrandTypes: PartnerBrandType[];
        typeBrandIds: string[];
      }>;

    if (candidate.length === 0) {
      return NextResponse.json({ data: [], summary: { avgSalesLiftPct: 0, storesImproved: 0, storesNotImproved: 0, incentiveChangeAvgPct: 0 } });
    }

    const storeIds = candidate.map(s => s.id);

    // 2) For pivot: last visit date per store (role-aware)
    // Physical visits
    const visitWhere: any = {
      storeId: { in: storeIds },
    };
    if (user.role === 'EXECUTIVE') {
      // Filter to this executive's visits only
      const exec = await prisma.executive.findUnique({ where: { userId: user.userId }, select: { id: true } });
      if (exec) visitWhere.executiveId = exec.id;
    } else if (user.role === 'ADMIN' && scopeExecutiveId) {
      visitWhere.executiveId = scopeExecutiveId;
    }

    const visits = await prisma.visit.findMany({
      where: visitWhere,
      select: { storeId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Digital visits
    const dVisitWhere: any = {
      storeId: { in: storeIds },
    };
    if (user.role === 'EXECUTIVE') {
      const exec = await prisma.executive.findUnique({ where: { userId: user.userId }, select: { id: true } });
      if (exec) dVisitWhere.executiveId = exec.id;
    } else if (user.role === 'ADMIN' && scopeExecutiveId) {
      dVisitWhere.executiveId = scopeExecutiveId;
    }

    const dVisits = await prisma.digitalVisit.findMany({
      where: dVisitWhere,
      select: { storeId: true, connectDate: true },
      orderBy: { connectDate: 'desc' },
    });

    const lastVisitMap = new Map<string, Date>();
    for (const v of visits) {
      const cur = lastVisitMap.get(v.storeId);
      if (!cur || v.createdAt > cur) lastVisitMap.set(v.storeId, v.createdAt);
    }
    for (const dv of dVisits) {
      const cur = lastVisitMap.get(dv.storeId);
      if (!cur || dv.connectDate > cur) lastVisitMap.set(dv.storeId, dv.connectDate);
    }

    // 3) Sales records for candidate stores and relevant brandIds
    const allBrandIds = Array.from(new Set(candidate.flatMap(c => c.typeBrandIds)));
    const salesRecords = await prisma.salesRecord.findMany({
      where: {
        storeId: { in: storeIds },
        brandId: { in: allBrandIds },
      },
      select: {
        storeId: true,
        brandId: true,
        dailySales: true, // [{ date: 'YYYY-MM-DD', planSales: number, revenue: number }]
      },
    });

    // Group sales by store
    const salesByStore = new Map<string, Array<{ brandId: string; dailySales: any[] }>>();
    for (const r of salesRecords) {
      const list = salesByStore.get(r.storeId) || [];
      list.push({ brandId: r.brandId, dailySales: (r.dailySales as any[]) || [] });
      salesByStore.set(r.storeId, list);
    }

    const windowCfg = brandWindows[brandParam];

    // Helper to sum sales and plans in a window
    const sumWindow = (daily: any[], start: Date, end: Date) => {
      let revenue = 0;
      let plans = 0;
      for (const d of daily) {
        const ds = String(d.date || '');
        if (!ds) continue;
        const dt = new Date(ds);
        if (dt >= start && dt <= end) {
          revenue += Number(d.revenue || 0);
          plans += Number(d.planSales || 0);
        }
      }
      return { revenue, plans };
    };

    const rows: any[] = [];

    // 4) For each store, compute metrics around the pivot
    for (const s of candidate) {
      const pivot = lastVisitMap.get(s.id);
      if (!pivot) continue; // no visits -> skip

      const beforeStart = addDays(pivot, -windowCfg.before);
      const beforeEnd = new Date(pivot.getTime());
      const afterStart = new Date(pivot.getTime());
      const afterEnd = addDays(pivot, windowCfg.after);

      // Sales
      const sr = salesByStore.get(s.id) || [];
      let salesBefore = 0;
      let salesAfter = 0;
      let plansBefore = 0;
      let plansAfter = 0;
      for (const r of sr) {
        if (!s.typeBrandIds.includes(r.brandId)) continue;
        const { revenue: revB, plans: plB } = sumWindow(r.dailySales, beforeStart, beforeEnd);
        const { revenue: revA, plans: plA } = sumWindow(r.dailySales, afterStart, afterEnd);
        salesBefore += revB;
        salesAfter += revA;
        plansBefore += plB;
        plansAfter += plA;
      }

      // Visits after (completed)
      const completedAfter = await prisma.visit.count({
        where: {
          storeId: s.id,
          ...(user.role === 'EXECUTIVE' ? { executive: { userId: user.userId } } : {}),
          createdAt: { gte: afterStart, lte: afterEnd },
        },
      }) + await prisma.digitalVisit.count({
        where: {
          storeId: s.id,
          ...(user.role === 'EXECUTIVE' ? { executive: { userId: user.userId } } : {}),
          connectDate: { gte: afterStart, lte: afterEnd },
        },
      });

      // Missed after: requires planned vs actual; set 0 for now (extendable)
      const missedAfter = 0;

      // Issues
      const raisedBefore = await prisma.issue.count({
        where: {
          createdAt: { gte: beforeStart, lte: beforeEnd },
          OR: [
            { visit: { storeId: s.id } },
            { digitalVisit: { storeId: s.id } },
          ],
        },
      });

      const resolvedAfter = await prisma.issue.count({
        where: {
          status: IssueStatus.Resolved,
          updatedAt: { gte: afterStart, lte: afterEnd },
          OR: [
            { visit: { storeId: s.id } },
            { digitalVisit: { storeId: s.id } },
          ],
        },
      });

      const pendingAfter = await prisma.issue.count({
        where: {
          status: { in: [IssueStatus.Pending, IssueStatus.Assigned] },
          createdAt: { gte: afterStart, lte: afterEnd },
          OR: [
            { visit: { storeId: s.id } },
            { digitalVisit: { storeId: s.id } },
          ],
        },
      });

      const lift = salesBefore > 0 ? ((salesAfter - salesBefore) / salesBefore) * 100 : (salesAfter > 0 ? 100 : 0);
      const incChange = plansBefore > 0 ? ((plansAfter - plansBefore) / plansBefore) * 100 : (plansAfter > 0 ? 100 : 0);

      rows.push({
        storeId: s.id,
        store: s.storeName,
        city: s.city || '-',
        brand: brandParam,
        lastVisit: fmtDate(pivot),
        salesBefore: Math.round(salesBefore),
        salesAfter: Math.round(salesAfter),
        salesImpact: `${lift >= 0 ? '+' : ''}${Math.round(lift)}%`,
        issues: {
          raisedBefore,
          resolvedAfter,
          pendingAfter,
        },
        incentives: {
          before: String(plansBefore),
          after: String(plansAfter),
        },
        visits: {
          completedAfter,
          missedAfter,
        },
      });
    }

    // 5) Summary
    const lifts = rows.map(r => {
      const b = r.salesBefore;
      const a = r.salesAfter;
      return b > 0 ? ((a - b) / b) * 100 : (a > 0 ? 100 : 0);
    });
    const avgSalesLiftPct = lifts.length ? Math.round(lifts.reduce((s, v) => s + v, 0) / lifts.length) : 0;
    const storesImproved = rows.filter(r => r.salesAfter > r.salesBefore).length;
    const storesNotImproved = rows.length - storesImproved;

    const incChanges = rows.map(r => {
      const b = Number(r.incentives.before);
      const a = Number(r.incentives.after);
      return b > 0 ? ((a - b) / b) * 100 : (a > 0 ? 100 : 0);
    });
    const incentiveChangeAvgPct = incChanges.length ? Math.round(incChanges.reduce((s, v) => s + v, 0) / incChanges.length) : 0;

    // Role-based disclosure: same endpoint supports both roles
    // Admin sees all (or scoped by executiveId). Executive sees only assigned stores.

    return NextResponse.json({
      data: rows,
      summary: { avgSalesLiftPct, storesImproved, storesNotImproved, incentiveChangeAvgPct },
      meta: { brand: brandParam, role: user.role as Role },
    });
  } catch (e) {
    console.error('analytics/impact error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
