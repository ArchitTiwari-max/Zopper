import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { PartnerBrandType, IssueStatus, Role } from '@prisma/client';
import { parseWeekValue, getCurrentWeekValue } from '@/lib/weekUtils';

// Map query string to Prisma enum
function parseBrandType(input: string | null | undefined): PartnerBrandType | null {
  const s = (input || '').trim();
  if (s === 'A+') return PartnerBrandType.A_PLUS;
  if (s === 'A') return PartnerBrandType.A;
  if (s === 'B') return PartnerBrandType.B;
  if (s === 'C') return PartnerBrandType.C;
  if (s === 'D') return PartnerBrandType.D;
  return null;
}

// Fixed window per requirements
const fixedWindow = { before: 7, after: 7 } as const;

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

// Day boundary helpers
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const weekParam = searchParams.get('week') || getCurrentWeekValue();
    const pbtParamRaw = searchParams.get('pbt') || 'All'; // default All
    const pbtEnum = parseBrandType(pbtParamRaw);
    // When pbtEnum is null, treat as 'All categories' (no filter)

    // Optional: admin can scope by executiveId or name
    const scopeExecutiveId = searchParams.get('executiveId');
    const executiveName = searchParams.get('executiveName');
    const brandIdFilter = searchParams.get('brandId');

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
    } else if (user.role === 'ADMIN') {
      if (scopeExecutiveId) {
        const exec = await prisma.executive.findUnique({
          where: { id: scopeExecutiveId },
          select: { executiveStores: { select: { storeId: true } } },
        });
        allowedStoreIds = exec?.executiveStores.map(es => es.storeId) || [];
      } else if (executiveName) {
        const exec = await prisma.executive.findFirst({
          where: { name: { contains: executiveName, mode: 'insensitive' } },
          select: { executiveStores: { select: { storeId: true } } },
        });
        allowedStoreIds = exec?.executiveStores.map(es => es.storeId) || [];
      }
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

    // Candidate stores filtered by selected partner brand type and optional brandId
    const candidate = stores
      .map(s => {
        const ids = s.partnerBrandIds || [];
        const types = (s.partnerBrandTypes || []) as PartnerBrandType[];
        let selectedIds: string[];
        if (!pbtEnum) {
          // No category filter -> include all brand IDs
          selectedIds = ids.slice();
        } else {
          const tmp: string[] = [];
          const len = Math.min(ids.length, types.length);
          for (let i = 0; i < len; i++) {
            if (types[i] === pbtEnum) tmp.push(ids[i]);
          }
          selectedIds = tmp;
        }
        // Optional brand filter
        if (brandIdFilter && brandIdFilter !== 'All') {
          selectedIds = selectedIds.filter(id => id === brandIdFilter);
        }
        return selectedIds.length > 0 ? { ...s, typeBrandIds: selectedIds } : null;
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

    // 2) Parse selected week range from the new format (YYYY-MM-DD)
    const weekRange = parseWeekValue(weekParam);
    if (!weekRange) {
      return NextResponse.json({ error: 'Invalid week format' }, { status: 400 });
    }
    const selStart = weekRange.startDate;
    const selEnd = weekRange.endDate;

    // 3) For pivot: last visit date per store within selected week (role-aware)
    // Physical visits
    const visitWhere: any = {
      storeId: { in: storeIds },
      createdAt: { gte: selStart, lte: selEnd },
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
      select: { storeId: true, createdAt: true, executive: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Digital visits
    const dVisitWhere: any = {
      storeId: { in: storeIds },
      connectDate: { gte: selStart, lte: selEnd },
    };
    if (user.role === 'EXECUTIVE') {
      const exec = await prisma.executive.findUnique({ where: { userId: user.userId }, select: { id: true } });
      if (exec) dVisitWhere.executiveId = exec.id;
    } else if (user.role === 'ADMIN' && scopeExecutiveId) {
      dVisitWhere.executiveId = scopeExecutiveId;
    }

    const dVisits = await prisma.digitalVisit.findMany({
      where: dVisitWhere,
      select: { storeId: true, connectDate: true, executive: { select: { name: true } } },
      orderBy: { connectDate: 'desc' },
    });

    type LastVisitInfo = { date: Date; execName: string };
    const lastVisitMap = new Map<string, LastVisitInfo>();
    for (const v of visits) {
      const cur = lastVisitMap.get(v.storeId);
      if (!cur || v.createdAt > cur.date) lastVisitMap.set(v.storeId, { date: v.createdAt, execName: v.executive?.name || '-' });
    }
    for (const dv of dVisits) {
      const cur = lastVisitMap.get(dv.storeId);
      if (!cur || dv.connectDate > cur.date) lastVisitMap.set(dv.storeId, { date: dv.connectDate, execName: dv.executive?.name || '-' });
    }

    // Compute global window across all stores' pivots to avoid N+1
    const pivotDates = Array.from(lastVisitMap.values()).map(v => v.date);
    if (pivotDates.length === 0) {
      return NextResponse.json({ data: [], summary: { avgSalesLiftPct: 0, storesImproved: 0, storesNotImproved: 0, avgRevenue: 0 } });
    }
    // Use calendar-day windows: Before = [startOfDay(pivot-7), endOfDay(pivot-1)], After = [startOfDay(pivot), endOfDay(pivot+6)]
    const firstBefore = startOfDay(addDays(pivotDates[0], -fixedWindow.before));
    const firstAfter = endOfDay(addDays(pivotDates[0], fixedWindow.after - 1));
    const globalBefore = pivotDates.reduce((min, d) => {
      const b = startOfDay(addDays(d, -fixedWindow.before));
      return b < min ? b : min;
    }, firstBefore);
    const globalAfter = pivotDates.reduce((max, d) => {
      const a = endOfDay(addDays(d, fixedWindow.after - 1));
      return a > max ? a : max;
    }, firstAfter);

    // Superset fetches for visits/digitalVisits and issues within the global window
    const supVisitWhere: any = { ...visitWhere, createdAt: { gte: globalBefore, lte: globalAfter } };
    const supDVisitWhere: any = { ...dVisitWhere, connectDate: { gte: globalBefore, lte: globalAfter } };

    const supVisits = await prisma.visit.findMany({
      where: supVisitWhere,
      select: { storeId: true, createdAt: true },
      orderBy: undefined,
    });
    const supDigitalVisits = await prisma.digitalVisit.findMany({
      where: supDVisitWhere,
      select: { storeId: true, connectDate: true },
      orderBy: undefined,
    });

    const supIssues = await prisma.issue.findMany({
      where: {
        AND: [
          { OR: [ { createdAt: { gte: globalBefore, lte: globalAfter } }, { updatedAt: { gte: globalBefore, lte: globalAfter } } ] },
          { OR: [ { visit: { storeId: { in: storeIds } } }, { digitalVisit: { storeId: { in: storeIds } } } ] },
        ],
      },
      select: {
        status: true,
        createdAt: true,
        updatedAt: true,
        visit: { select: { storeId: true } },
        digitalVisit: { select: { storeId: true } },
      },
      orderBy: undefined,
    });

    // 4) Sales records for candidate stores and all their brandIds
    const allBrandIds = Array.from(new Set(candidate.flatMap(c => c.typeBrandIds)));

    // Fetch brand names for all brand IDs
    const brandRows = await prisma.brand.findMany({ where: { id: { in: allBrandIds } }, select: { id: true, brandName: true } });
    const brandNameById = new Map<string, string>(brandRows.map(b => [b.id, b.brandName]));

    const salesRecords = await prisma.salesRecord.findMany({
      where: {
        storeId: { in: storeIds },
        brandId: { in: allBrandIds },
      },
      select: {
        storeId: true,
        brandId: true,
        dailySales: true, // grouped by month { "1": [ { date: 'DD-MM-YYYY', countOfSales, revenue } ], ... }
      },
    });

    // Group sales by store
    const salesByStore = new Map<string, Array<{ brandId: string; dailySales: Record<string, any[]> }>>();
    for (const r of salesRecords) {
      const list = salesByStore.get(r.storeId) || [];
      list.push({ brandId: r.brandId, dailySales: (r.dailySales as Record<string, any[]>) || {} });
      salesByStore.set(r.storeId, list);
    }

    const windowCfg = fixedWindow; // always ±7 days

    // Helper to sum revenue and countOfSales in a window from grouped dailySales
    const sumWindow = (dailyByMonth: Record<string, any[]>, start: Date, end: Date) => {
      let revenue = 0;
      let plans = 0;
      for (const entries of Object.values(dailyByMonth || {})) {
        if (!Array.isArray(entries)) continue;
        for (const d of entries) {
          const ds = String(d.date || '');
          if (!ds) continue;
          const [dd, mm, yyyy] = ds.split('-');
          const dt = new Date(`${yyyy}-${mm}-${dd}`);
          if (dt >= start && dt <= end) {
            revenue += Number(d.revenue || 0);
            plans += Number(d.countOfSales || 0);
          }
        }
      }
      return { revenue, plans };
    };

    const rows: any[] = [];

    // 4) For each store, compute metrics around the pivot
    for (const s of candidate) {
      const pivotInfo = lastVisitMap.get(s.id);
      if (!pivotInfo) continue; // no visits -> skip

      const pivot = pivotInfo.date;
      // Before: 7 calendar days strictly before pivot (exclude pivot day)
      const beforeStart = startOfDay(addDays(pivot, -windowCfg.before)); // pivot-7 at 00:00:00
      const beforeEnd = endOfDay(addDays(pivot, -1));                    // day before pivot at 23:59:59
      // After: include pivot day through next 6 days
      const afterStart = startOfDay(pivot);                              // pivot day 00:00:00
      const afterEnd = endOfDay(addDays(pivot, windowCfg.after - 1));    // pivot+6 at 23:59:59

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

      // Aggregate visits/digitalVisits (no per-store queries)
      const vForStore = supVisits.filter(v => v.storeId === s.id);
      const dvForStore = supDigitalVisits.filter(dv => dv.storeId === s.id);
      const completedAfter = vForStore.filter(v => v.createdAt >= afterStart && v.createdAt <= afterEnd).length +
        dvForStore.filter(dv => dv.connectDate >= afterStart && dv.connectDate <= afterEnd).length;

      // Aggregate issues (no per-store queries)
      const issuesForStore = supIssues.filter(ix => (ix.visit?.storeId === s.id) || (ix.digitalVisit?.storeId === s.id));
      const raisedBefore = issuesForStore.filter(ix => ix.createdAt >= beforeStart && ix.createdAt <= beforeEnd).length;
      const resolvedAfter = issuesForStore.filter(ix => ix.status === IssueStatus.Resolved && ix.updatedAt && ix.updatedAt >= afterStart && ix.updatedAt <= afterEnd).length;
      const pendingAfter = issuesForStore.filter(ix => (ix.status === IssueStatus.Pending || ix.status === IssueStatus.Assigned) && ix.createdAt >= afterStart && ix.createdAt <= afterEnd).length;

      // 4) For each store, compute metrics around the pivot
      // 14-point series: -7..-1 (before) and 0..+6 (after, including pivot day)
      const points: Array<{ date: string; displayDate: string; revenue: number; dayOffset: number }> = [];
      const sumRevenueOnDate = (dateStrDDMMYYYY: string): number => {
        let rev = 0;
        for (const r of sr) {
          if (!s.typeBrandIds.includes(r.brandId)) continue;
          const dailyByMonth = r.dailySales || {};
          for (const entries of Object.values(dailyByMonth)) {
            if (!Array.isArray(entries)) continue;
            for (const d of entries as any[]) {
              if (String(d.date) === dateStrDDMMYYYY) rev += Number(d.revenue || 0);
            }
          }
        }
        return rev;
      };
      for (let i = -7; i <= 6; i++) {
        const dt = addDays(pivot, i);
        const ddmmyyyy = fmtDate(dt);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        points.push({ date: iso, displayDate: ddmmyyyy, revenue: sumRevenueOnDate(ddmmyyyy), dayOffset: i });
      }

      // Missed after: requires planned vs actual; set 0 for now (extendable)
      const missedAfter = 0;

      const lift = salesBefore > 0 ? ((salesAfter - salesBefore) / salesBefore) * 100 : (salesAfter > 0 ? 100 : 0);
      const incChange = plansBefore > 0 ? ((plansAfter - plansBefore) / plansBefore) * 100 : (plansAfter > 0 ? 100 : 0);

      const brandNames = s.typeBrandIds.map(id => brandNameById.get(id)).filter(Boolean) as string[];

      // Derive actual categories (PartnerBrandType) for the selected brandIds on this row
      const idToType = new Map<string, PartnerBrandType | null>();
      const idsArr = s.partnerBrandIds || [];
      const typesArr = (s.partnerBrandTypes || []) as PartnerBrandType[];
      const len = Math.min(idsArr.length, typesArr.length);
      for (let i = 0; i < len; i++) {
        idToType.set(idsArr[i], typesArr[i] ?? null);
      }
      const typeToLabel = (t: PartnerBrandType | null | undefined) => {
        if (!t) return 'None';
        return t === 'A_PLUS' ? 'A+' : t;
      };
      const categoryNames = Array.from(new Set(
        (s.typeBrandIds || []).map(id => typeToLabel(idToType.get(id)))
      ));

      rows.push({
        storeId: s.id,
        store: s.storeName,
        city: s.city || '-',
        brand: pbtParamRaw,
        brandNames: brandNames,
        categoryNames: categoryNames.length ? categoryNames : ['None'],
        lastVisit: fmtDate(pivot),
        lastVisitedBy: pivotInfo.execName,
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
        trend: { points },
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

    // Average of (After - Before) revenue across stores (absolute number, can be negative)
    const avgRevenue = rows.length
      ? Math.round(rows.reduce((s, r) => s + (Number(r.salesAfter || 0) - Number(r.salesBefore || 0)), 0) / rows.length)
      : 0;

    // Role-based disclosure: same endpoint supports both roles
    // Admin sees all (or scoped by executiveId). Executive sees only assigned stores.

    return NextResponse.json({
      data: rows,
      summary: { avgSalesLiftPct, storesImproved, storesNotImproved, avgRevenue },
      meta: { 
        week: weekParam, 
        weekStart: selStart.toISOString().split('T')[0], 
        weekEnd: selEnd.toISOString().split('T')[0], 
        partnerBrandType: pbtParamRaw, 
        role: user.role as Role 
      },
    });
  } catch (e) {
    console.error('analytics/impact error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
