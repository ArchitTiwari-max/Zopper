import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { PartnerBrandType, IssueStatus, Role } from '@prisma/client';
import { parseWeekValue, getCurrentWeekValue } from '@/lib/weekUtils';

export const runtime = 'nodejs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBrandType(input: string | null | undefined): PartnerBrandType | null {
  switch ((input || '').trim()) {
    case 'A+': return PartnerBrandType.A_PLUS;
    case 'A':  return PartnerBrandType.A;
    case 'B':  return PartnerBrandType.B;
    case 'C':  return PartnerBrandType.C;
    case 'D':  return PartnerBrandType.D;
    default:   return null;
  }
}

const fixedWindow = { before: 7, after: 7 } as const;

function fmtDate(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${m}-${y}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

// Fast UTC epoch for a calendar day (no local-TZ shift)
const dayStartMs = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
const dayEndMs   = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// ── Types ────────────────────────────────────────────────────────────────────

type DayEntry = { revenue: number; plans: number; ts: number };

// storeId → brandId → dateString(DD-MM-YYYY) → DayEntry
type SalesIndex = Map<string, Map<string, Map<string, DayEntry>>>;

// ── API Handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const weekParam    = searchParams.get('week') || getCurrentWeekValue();
    const pbtParamRaw  = searchParams.get('pbt') || 'All';
    const pbtEnum      = parseBrandType(pbtParamRaw);
    const scopeExecId  = searchParams.get('executiveId');
    const executiveName= searchParams.get('executiveName');
    const brandIdFilter= searchParams.get('brandId');

    // ── 1) Resolve executive ID once (used in multiple places below) ──────────
    let resolvedExecId: string | null = null;

    if (user.role === 'EXECUTIVE') {
      const exec = await prisma.executive.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      if (!exec) return NextResponse.json({ data: [], summary: null });
      resolvedExecId = exec.id;
    } else if (user.role === 'ADMIN' && scopeExecId) {
      resolvedExecId = scopeExecId;
    } else if (user.role === 'ADMIN' && executiveName) {
      const exec = await prisma.executive.findFirst({
        where: { name: { contains: executiveName, mode: 'insensitive' } },
        select: { id: true },
      });
      resolvedExecId = exec?.id ?? null;
    }

    // ── 2) Allowed store IDs ──────────────────────────────────────────────────
    let allowedStoreIds: string[] | null = null;

    if (resolvedExecId) {
      const exec = await prisma.executive.findUnique({
        where: { id: resolvedExecId },
        select: { executiveStores: { select: { storeId: true } } },
      });
      allowedStoreIds = exec?.executiveStores.map(es => es.storeId) ?? [];
    }

    // ── 3) Candidate stores ───────────────────────────────────────────────────
    const stores = await prisma.store.findMany({
      where: allowedStoreIds ? { id: { in: allowedStoreIds } } : {},
      select: { id: true, storeName: true, city: true, partnerBrandIds: true, partnerBrandTypes: true },
    });

    const candidate = stores
      .map(s => {
        const ids   = s.partnerBrandIds || [];
        const types = (s.partnerBrandTypes || []) as PartnerBrandType[];
        let selectedIds: string[];
        if (!pbtEnum) {
          selectedIds = ids.slice();
        } else {
          const tmp: string[] = [];
          const len = Math.min(ids.length, types.length);
          for (let i = 0; i < len; i++) {
            if (types[i] === pbtEnum) tmp.push(ids[i]);
          }
          selectedIds = tmp;
        }
        if (brandIdFilter && brandIdFilter !== 'All') {
          selectedIds = selectedIds.filter(id => id === brandIdFilter);
        }
        return selectedIds.length > 0 ? { ...s, typeBrandIds: selectedIds } : null;
      })
      .filter(Boolean) as Array<{
        id: string; storeName: string; city: string | null;
        partnerBrandIds: string[]; partnerBrandTypes: PartnerBrandType[];
        typeBrandIds: string[];
      }>;

    if (candidate.length === 0) {
      return NextResponse.json({
        data: [],
        summary: { avgSalesLiftPct: 0, storesImproved: 0, storesNotImproved: 0, avgRevenue: 0 },
      });
    }

    const storeIds    = candidate.map(s => s.id);
    const storeIdsSet = new Set(storeIds);

    // ── 4) Parse week ─────────────────────────────────────────────────────────
    const weekRange = parseWeekValue(weekParam);
    if (!weekRange) return NextResponse.json({ error: 'Invalid week format' }, { status: 400 });
    const selStart = weekRange.startDate;
    const selEnd   = weekRange.endDate;

    // ── 5) Pivot: last visit per store in selected week ───────────────────────
    const visitWhere: any = {
      storeId: { in: storeIds },
      visitDate: { gte: selStart, lte: selEnd },
    };
    const dVisitWhere: any = {
      storeId: { in: storeIds },
      connectDate: { gte: selStart, lte: selEnd },
    };
    if (resolvedExecId) {
      visitWhere.executiveId  = resolvedExecId;
      dVisitWhere.executiveId = resolvedExecId;
    }

    const [pivotVisitsRaw, pivotDVisitsRaw] = await Promise.all([
      prisma.visit.findMany({
        where: visitWhere,
        select: { storeId: true, visitDate: true, createdAt: true, executiveId: true },
        orderBy: { visitDate: 'desc' },
      }),
      prisma.digitalVisit.findMany({
        where: dVisitWhere,
        select: { storeId: true, connectDate: true, executiveId: true },
        orderBy: { connectDate: 'desc' },
      }),
    ]);

    // Resolve executives in memory to avoid Prisma N+1 join overhead
    const execIds = Array.from(new Set([
      ...pivotVisitsRaw.map(v => v.executiveId),
      ...pivotDVisitsRaw.map(v => v.executiveId)
    ]));
    
    const execNameMap = new Map<string, string>();
    if (execIds.length > 0) {
      const execs = await prisma.executive.findMany({
        where: { id: { in: execIds } },
        select: { id: true, name: true }
      });
      for (const e of execs) execNameMap.set(e.id, e.name);
    }

    type LastVisitInfo = { date: Date; execName: string };
    const lastVisitMap = new Map<string, LastVisitInfo>();

    for (const v of pivotVisitsRaw) {
      const vDate = (v.visitDate || v.createdAt) as Date;
      const cur = lastVisitMap.get(v.storeId);
      if (!cur || vDate > cur.date) lastVisitMap.set(v.storeId, { date: vDate, execName: execNameMap.get(v.executiveId) || '-' });
    }
    for (const dv of pivotDVisitsRaw) {
      const cur = lastVisitMap.get(dv.storeId);
      if (!cur || dv.connectDate > cur.date) lastVisitMap.set(dv.storeId, { date: dv.connectDate, execName: execNameMap.get(dv.executiveId) || '-' });
    }

    const pivotDates = Array.from(lastVisitMap.values()).map(v => v.date);
    if (pivotDates.length === 0) {
      return NextResponse.json({
        data: [],
        summary: { avgSalesLiftPct: 0, storesImproved: 0, storesNotImproved: 0, avgRevenue: 0 },
      });
    }

    // ── 6) Compute global window across all store pivots ──────────────────────
    let globalBeforeTs = Infinity, globalAfterTs = -Infinity;
    for (const d of pivotDates) {
      const bTs = dayStartMs(addDays(d, -fixedWindow.before));
      const aTs = dayEndMs(addDays(d, fixedWindow.after - 1));
      if (bTs < globalBeforeTs) globalBeforeTs = bTs;
      if (aTs > globalAfterTs)  globalAfterTs  = aTs;
    }
    const globalBefore = new Date(globalBeforeTs);
    const globalAfter  = new Date(globalAfterTs);

    // Derive years spanned (for scoped sales fetch)
    const yearSet = new Set<number>();
    for (let y = globalBefore.getFullYear(); y <= globalAfter.getFullYear(); y++) yearSet.add(y);
    const years = Array.from(yearSet);

    // ── 7) Fetch all data concurrently ────────────────────────────────────────
    const allBrandIds = Array.from(new Set(candidate.flatMap(c => c.typeBrandIds)));

    const supVisitWhere: any  = { storeId: { in: storeIds }, visitDate:  { gte: globalBefore, lte: globalAfter } };
    const supDVisitWhere: any = { storeId: { in: storeIds }, connectDate: { gte: globalBefore, lte: globalAfter } };
    if (resolvedExecId) {
      supVisitWhere.executiveId  = resolvedExecId;
      supDVisitWhere.executiveId = resolvedExecId;
    }

    const [supVisits, supDigitalVisits, brandRows, salesRecords] = await Promise.all([
      prisma.visit.findMany({
        where: supVisitWhere,
        select: { id: true, storeId: true, visitDate: true, createdAt: true },
      }),
      prisma.digitalVisit.findMany({
        where: supDVisitWhere,
        select: { id: true, storeId: true, connectDate: true },
      }),
      prisma.brand.findMany({
        where: { id: { in: allBrandIds } },
        select: { id: true, brandName: true },
      }),
      // Scope by year to avoid full-collection scan
      prisma.salesRecord.findMany({
        where: {
          storeId: { in: storeIds },
          brandId: { in: allBrandIds },
          year:    { in: years },
        },
        select: { storeId: true, brandId: true, dailySales: true },
      }),
    ]);

    // Fetch issues linked to THESE visits ONLY. Eliminates full issue scan + relations.
    const visitIds = supVisits.map(v => v.id);
    const dVisitIds = supDigitalVisits.map(v => v.id);
    
    // Create mapping from visit ID to store ID for quick lookup
    const visitIdToStoreId = new Map<string, string>();
    for (const v of supVisits) visitIdToStoreId.set(v.id, v.storeId);
    for (const dv of supDigitalVisits) visitIdToStoreId.set(dv.id, dv.storeId);

    let supIssuesRaw: any[] = [];
    if (visitIds.length > 0 || dVisitIds.length > 0) {
      supIssuesRaw = await prisma.issue.findMany({
        where: {
          OR: [
            ...(visitIds.length > 0 ? [{ visitId: { in: visitIds } }] : []),
            ...(dVisitIds.length > 0 ? [{ digitalVisitId: { in: dVisitIds } }] : [])
          ]
        },
        select: {
          status: true, createdAt: true, updatedAt: true,
          visitId: true, digitalVisitId: true
        }
      });
    }

    // ── 8) Pre-build indexes (O(n), done once) ────────────────────────────────

    // 8a) Brand name lookup
    const brandNameById = new Map<string, string>(brandRows.map(b => [b.id, b.brandName]));

    // 8b) Sales index: storeId → brandId → "DD-MM-YYYY" → DayEntry
    //     Parse dailySales JSON exactly once; store pre-computed UTC epoch per entry.
    const salesIndex: SalesIndex = new Map();

    for (const r of salesRecords) {
      let byBrand = salesIndex.get(r.storeId);
      if (!byBrand) { byBrand = new Map(); salesIndex.set(r.storeId, byBrand); }

      let dayMap = byBrand.get(r.brandId);
      if (!dayMap) { dayMap = new Map(); byBrand.set(r.brandId, dayMap); }

      const dailyByMonth = (r.dailySales as Record<string, any[]>) || {};
      for (const entries of Object.values(dailyByMonth)) {
        if (!Array.isArray(entries)) continue;
        for (const d of entries) {
          const ds = String(d.date || '');
          if (!ds) continue;
          const [dd, mm, yyyy] = ds.split('-');
          const ts = Date.UTC(+yyyy, +mm - 1, +dd);
          const prev = dayMap.get(ds);
          if (prev) {
            prev.revenue += Number(d.revenue || 0);
            prev.plans   += Number(d.countOfSales || 0);
          } else {
            dayMap.set(ds, { revenue: Number(d.revenue || 0), plans: Number(d.countOfSales || 0), ts });
          }
        }
      }
    }

    // 8c) Visits index: storeId → array of { ts: number }
    const visitsByStore    = new Map<string, Array<{ ts: number }>>();
    const dVisitsByStore   = new Map<string, Array<{ ts: number }>>();

    for (const v of supVisits) {
      const arr = visitsByStore.get(v.storeId) || [];
      arr.push({ ts: ((v.visitDate || v.createdAt) as Date).getTime() });
      visitsByStore.set(v.storeId, arr);
    }
    for (const dv of supDigitalVisits) {
      const arr = dVisitsByStore.get(dv.storeId) || [];
      arr.push({ ts: dv.connectDate.getTime() });
      dVisitsByStore.set(dv.storeId, arr);
    }

    // 8d) Issues index: storeId → array of issue snapshots
    type IssueSnap = { status: IssueStatus; createdTs: number; updatedTs: number | null };
    const issuesByStore = new Map<string, IssueSnap[]>();

    for (const ix of supIssuesRaw) {
      const sId = (ix.visitId ? visitIdToStoreId.get(ix.visitId) : null) ?? 
                  (ix.digitalVisitId ? visitIdToStoreId.get(ix.digitalVisitId) : null);
      if (!sId || !storeIdsSet.has(sId)) continue;
      const arr = issuesByStore.get(sId) || [];
      arr.push({
        status:    ix.status,
        createdTs: ix.createdAt.getTime(),
        updatedTs: ix.updatedAt ? ix.updatedAt.getTime() : null,
      });
      issuesByStore.set(sId, arr);
    }

    // ── 9) Helper: sum revenue+plans for a brand's dayMap over [startT, endT] ─
    const sumWindow = (dayMap: Map<string, DayEntry>, startT: number, endT: number) => {
      let revenue = 0, plans = 0;
      for (const e of dayMap.values()) {
        if (e.ts >= startT && e.ts <= endT) { revenue += e.revenue; plans += e.plans; }
      }
      return { revenue, plans };
    };

    // ── 10) Build result rows ─────────────────────────────────────────────────
    const rows: any[] = [];

    for (const s of candidate) {
      const pivotInfo = lastVisitMap.get(s.id);
      if (!pivotInfo) continue;

      const pivot = pivotInfo.date;

      // Window boundaries as UTC epoch numbers (computed once per store)
      const bsT = dayStartMs(addDays(pivot, -fixedWindow.before));
      const beT = dayEndMs(addDays(pivot, -1));
      const asT = dayStartMs(pivot);
      const aeT = dayEndMs(addDays(pivot, fixedWindow.after - 1));

      // Sales aggregation — pure Map lookups, no Date construction inside loops
      let salesBefore = 0, salesAfter = 0, plansBefore = 0, plansAfter = 0;
      const byBrand = salesIndex.get(s.id);
      if (byBrand) {
        for (const bId of s.typeBrandIds) {
          const dayMap = byBrand.get(bId);
          if (!dayMap) continue;
          const { revenue: revB, plans: plB } = sumWindow(dayMap, bsT, beT);
          const { revenue: revA, plans: plA } = sumWindow(dayMap, asT, aeT);
          salesBefore += revB; salesAfter += revA;
          plansBefore += plB; plansAfter += plA;
        }
      }

      // Visits count — numeric epoch comparison
      const svArr  = visitsByStore.get(s.id)  || [];
      const sdvArr = dVisitsByStore.get(s.id) || [];
      const completedAfter =
        svArr.filter(v  => v.ts >= asT && v.ts <= aeT).length +
        sdvArr.filter(v => v.ts >= asT && v.ts <= aeT).length;

      // Issues
      const issArr = issuesByStore.get(s.id) || [];
      const raisedBefore  = issArr.filter(ix => ix.createdTs >= bsT && ix.createdTs <= beT).length;
      const resolvedAfter = issArr.filter(ix =>
        ix.status === IssueStatus.Resolved && ix.updatedTs !== null &&
        ix.updatedTs >= asT && ix.updatedTs <= aeT
      ).length;
      const pendingAfter = issArr.filter(ix =>
        (ix.status === IssueStatus.Pending || ix.status === IssueStatus.Assigned) &&
        ix.createdTs >= asT && ix.createdTs <= aeT
      ).length;

      // 14-point daily trend series — O(14 × brands), pure Map lookups
      const points: Array<{ date: string; displayDate: string; revenue: number; dayOffset: number }> = [];
      for (let i = -7; i <= 6; i++) {
        const dt       = addDays(pivot, i);
        const ddmmyyyy = fmtDate(dt);
        const iso      = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        let rev = 0;
        if (byBrand) {
          for (const bId of s.typeBrandIds) {
            rev += byBrand.get(bId)?.get(ddmmyyyy)?.revenue ?? 0;
          }
        }
        points.push({ date: iso, displayDate: ddmmyyyy, revenue: rev, dayOffset: i });
      }

      const lift      = salesBefore > 0 ? ((salesAfter  - salesBefore)  / salesBefore)  * 100 : (salesAfter  > 0 ? 100 : 0);
      const incChange = plansBefore > 0 ? ((plansAfter  - plansBefore)  / plansBefore)  * 100 : (plansAfter  > 0 ? 100 : 0);

      const brandNames = s.typeBrandIds.map(id => brandNameById.get(id)).filter(Boolean) as string[];

      // Category labels
      const idToType = new Map<string, PartnerBrandType | null>();
      const idsArr   = s.partnerBrandIds || [];
      const typesArr = (s.partnerBrandTypes || []) as PartnerBrandType[];
      const len      = Math.min(idsArr.length, typesArr.length);
      for (let i = 0; i < len; i++) idToType.set(idsArr[i], typesArr[i] ?? null);
      const typeToLabel = (t: PartnerBrandType | null | undefined) =>
        !t ? 'None' : t === 'A_PLUS' ? 'A+' : t;
      const categoryNames = Array.from(new Set((s.typeBrandIds || []).map(id => typeToLabel(idToType.get(id)))));

      rows.push({
        storeId:      s.id,
        store:        s.storeName,
        city:         s.city || '-',
        brand:        pbtParamRaw,
        brandNames,
        categoryNames: categoryNames.length ? categoryNames : ['None'],
        lastVisit:    fmtDate(pivot),
        lastVisitedBy: pivotInfo.execName,
        salesBefore:  Math.round(salesBefore),
        salesAfter:   Math.round(salesAfter),
        salesImpact:  `${lift >= 0 ? '+' : ''}${Math.round(lift)}%`,
        issues:       { raisedBefore, resolvedAfter, pendingAfter },
        incentives:   { before: String(plansBefore), after: String(plansAfter) },
        visits:       { completedAfter, missedAfter: 0 },
        trend:        { points },
      });
    }

    // ── 11) Summary ───────────────────────────────────────────────────────────
    const totalSalesBefore = rows.reduce((s, r) => s + (Number(r.salesBefore) || 0), 0);
    const totalSalesAfter  = rows.reduce((s, r) => s + (Number(r.salesAfter)  || 0), 0);
    const avgSalesLiftPct  = totalSalesBefore > 0
      ? Math.round(((totalSalesAfter - totalSalesBefore) / totalSalesBefore) * 100)
      : (totalSalesAfter > 0 ? 100 : 0);
    const storesImproved    = rows.filter(r => r.salesAfter > r.salesBefore).length;
    const storesNotImproved = rows.length - storesImproved;
    const avgRevenue        = Math.round(totalSalesAfter - totalSalesBefore);

    return NextResponse.json({
      data: rows,
      summary: { avgSalesLiftPct, storesImproved, storesNotImproved, avgRevenue },
      meta: {
        week:            weekParam,
        weekStart:       selStart.toISOString().split('T')[0],
        weekEnd:         selEnd.toISOString().split('T')[0],
        partnerBrandType: pbtParamRaw,
        role:            user.role as Role,
      },
    });
  } catch (e) {
    console.error('analytics/impact error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
