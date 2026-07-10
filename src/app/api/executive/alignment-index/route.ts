import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// ─── City → SVG Coordinate Map ────────────────────────────────────────────────
const CITY_COORDS: Record<string, { x: number; y: number; state: string }> = {
  mumbai: { x: 175, y: 490, state: "Maharashtra" },
  pune: { x: 188, y: 508, state: "Maharashtra" },
  nagpur: { x: 255, y: 440, state: "Maharashtra" },
  nashik: { x: 188, y: 468, state: "Maharashtra" },
  thane: { x: 178, y: 488, state: "Maharashtra" },
  aurangabad: { x: 215, y: 472, state: "Maharashtra" },
  delhi: { x: 240, y: 230, state: "Delhi" },
  "new delhi": { x: 240, y: 230, state: "Delhi" },
  gurgaon: { x: 242, y: 238, state: "Haryana" },
  gurugram: { x: 242, y: 238, state: "Haryana" },
  noida: { x: 248, y: 234, state: "Uttar Pradesh" },
  faridabad: { x: 246, y: 240, state: "Haryana" },
  ghaziabad: { x: 248, y: 230, state: "Uttar Pradesh" },
  bangalore: { x: 225, y: 590, state: "Karnataka" },
  bengaluru: { x: 225, y: 590, state: "Karnataka" },
  mysuru: { x: 218, y: 608, state: "Karnataka" },
  mysore: { x: 218, y: 608, state: "Karnataka" },
  hubli: { x: 198, y: 560, state: "Karnataka" },
  mangalore: { x: 196, y: 588, state: "Karnataka" },
  chennai: { x: 258, y: 616, state: "Tamil Nadu" },
  coimbatore: { x: 224, y: 638, state: "Tamil Nadu" },
  madurai: { x: 244, y: 652, state: "Tamil Nadu" },
  hyderabad: { x: 248, y: 530, state: "Telangana" },
  secunderabad: { x: 252, y: 528, state: "Telangana" },
  visakhapatnam: { x: 295, y: 522, state: "Andhra Pradesh" },
  ahmedabad: { x: 163, y: 370, state: "Gujarat" },
  surat: { x: 162, y: 415, state: "Gujarat" },
  vadodara: { x: 172, y: 390, state: "Gujarat" },
  rajkot: { x: 138, y: 368, state: "Gujarat" },
  jaipur: { x: 218, y: 272, state: "Rajasthan" },
  jodhpur: { x: 185, y: 285, state: "Rajasthan" },
  udaipur: { x: 194, y: 320, state: "Rajasthan" },
  lucknow: { x: 290, y: 278, state: "Uttar Pradesh" },
  kanpur: { x: 284, y: 286, state: "Uttar Pradesh" },
  agra: { x: 258, y: 264, state: "Uttar Pradesh" },
  varanasi: { x: 318, y: 302, state: "Uttar Pradesh" },
  kolkata: { x: 370, y: 378, state: "West Bengal" },
  chandigarh: { x: 228, y: 190, state: "Chandigarh" },
  ludhiana: { x: 216, y: 188, state: "Punjab" },
  amritsar: { x: 204, y: 182, state: "Punjab" },
  bhopal: { x: 245, y: 368, state: "Madhya Pradesh" },
  indore: { x: 220, y: 378, state: "Madhya Pradesh" },
  kochi: { x: 218, y: 660, state: "Kerala" },
  thiruvananthapuram: { x: 220, y: 690, state: "Kerala" },
  bhubaneswar: { x: 338, y: 428, state: "Odisha" },
};

const getCityCoords = (city: string): { x: number; y: number; state: string } => {
  const key = city.toLowerCase().trim();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return { x: 260, y: 420, state: "Maharashtra" };
};

// ─── Score Computation ────────────────────────────────────────────────────────
const computeStoreScore = (store: any): number => {
  const alignment = store.alignment;
  if (!alignment) return 0;

  const storeNameUp = store.storeName.toUpperCase();
  const isCroma = storeNameUp.includes("CROMA");

  const storeLevel: any[] = Array.isArray(alignment.storeLevel) ? alignment.storeLevel : [];
  const stakeholderLevel: any[] = Array.isArray(alignment.stakeholderLevel) ? alignment.stakeholderLevel : [];

  const isRoleAligned = (roleName: string, levelData: any[]): boolean => {
    const roleEntry = levelData.find(
      (r: any) => r.role?.trim().toUpperCase() === roleName.toUpperCase()
    );
    if (!roleEntry || !roleEntry.personnel) return false;
    return roleEntry.personnel.some(
      (p: any) => p.name?.trim() !== "" && /^[0-9]{10}$/.test(p.phone?.trim() || "")
    );
  };

  let score = 0;
  if (isRoleAligned("SEC", storeLevel)) score += 40;
  if (isRoleAligned("Store Manager", storeLevel)) score += 10;
  if (isCroma) {
    if (isRoleAligned("ADM", storeLevel)) score += 20;
    if (isRoleAligned("Cluster Manager", storeLevel)) score += 5;
  } else {
    if (isRoleAligned("TL", storeLevel)) score += 20;
    if (isRoleAligned("Category Manager", storeLevel)) score += 5;
  }
  if (isRoleAligned("ABM", stakeholderLevel)) score += 5;
  if (isRoleAligned("ASE", stakeholderLevel)) score += 5;
  if (isRoleAligned("ZSE", stakeholderLevel)) score += 5;
  if (isRoleAligned("ZSM", stakeholderLevel)) score += 5;
  if (isRoleAligned("KAM", stakeholderLevel)) score += 5;

  return Math.min(score, 100);
};

const buildStoreEntry = (store: any) => {
  const score = computeStoreScore(store);
  const storeNameUp = store.storeName.toUpperCase();
  const storeType = storeNameUp.includes("CROMA")
    ? "Croma"
    : storeNameUp.includes("RELIANCE")
    ? "Reliance"
    : "Vijay Sales";
  const coords = getCityCoords(store.city || "");
  const alignment: any = store.alignment;

  return {
    id: store.id,
    name: store.storeName,
    city: store.city,
    state: store.state || coords.state,
    code: store.id.toString(),
    x: coords.x,
    y: coords.y,
    storeType,
    score,
    alignment: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    storeLevel: alignment?.storeLevel ?? [],
    stakeholderLevel: alignment?.stakeholderLevel ?? [],
  };
};

const isBrandStore = (storeName: string) => {
  const u = storeName.toUpperCase();
  return u.includes("CROMA") || u.includes("VS") || u.includes("RELIANCE");
};

/**
 * GET /api/executive/alignment-index
 *
 * Returns alignment data for the current manager executive:
 * - self: own stores
 * - subordinates: array of { id, name, stores[] } for each junior
 *
 * Query params:
 *   storeId  → fetch single store detail (storeLevel + stakeholderLevel)
 */
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user || !user.roles.includes('EXECUTIVE')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");

    // ── Single store detail ───────────────────────────────────────────────────
    if (storeId) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { alignment: true },
      });
      if (!store) {
        return NextResponse.json({ error: "Store not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: buildStoreEntry(store) });
    }

    // ── Find the logged-in executive ─────────────────────────────────────────
    const executive = await prisma.employee.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        subordinateIds: true,
        employeeStores: { select: { storeId: true } },
      },
    });

    if (!executive) {
      return NextResponse.json({ error: "Executive not found" }, { status: 404 });
    }

    const selfStoreIds = executive.employeeStores.map((es) => es.storeId);

    // ── Fetch own stores ──────────────────────────────────────────────────────
    const selfStoresRaw = selfStoreIds.length
      ? await prisma.store.findMany({
          where: { id: { in: selfStoreIds } },
          include: { alignment: true },
        })
      : [];

    const selfStores = selfStoresRaw
      .filter((s) => isBrandStore(s.storeName))
      .map(buildStoreEntry);

    // ── Fetch each subordinate and their stores ───────────────────────────────
    const subordinatesData: { id: string; name: string; stores: any[] }[] = [];

    if (executive.subordinateIds && executive.subordinateIds.length > 0) {
      const subordinates = await prisma.employee.findMany({
        where: { id: { in: executive.subordinateIds } },
        select: {
          id: true,
          name: true,
          employeeStores: { select: { storeId: true } },
        },
      });

      // Collect all subordinate store IDs to batch-fetch
      const allSubStoreIds = Array.from(
        new Set(subordinates.flatMap((sub) => sub.employeeStores.map((es) => es.storeId)))
      );

      const allSubStoresRaw = allSubStoreIds.length
        ? await prisma.store.findMany({
            where: { id: { in: allSubStoreIds } },
            include: { alignment: true },
          })
        : [];

      const storeMap = new Map(allSubStoresRaw.map((s) => [s.id, s]));

      for (const sub of subordinates) {
        const subStoreIds = sub.employeeStores.map((es) => es.storeId);
        const subStores = subStoreIds
          .map((id) => storeMap.get(id))
          .filter((s): s is NonNullable<typeof s> => !!s && isBrandStore(s.storeName))
          .map(buildStoreEntry);

        subordinatesData.push({
          id: sub.id,
          name: sub.name,
          stores: subStores,
        });
      }
    }

    return NextResponse.json({
      success: true,
      self: {
        id: executive.id,
        name: executive.name,
        stores: selfStores,
      },
      subordinates: subordinatesData,
    });
  } catch (error) {
    console.error("Error fetching executive alignment index:", error);
    return NextResponse.json(
      { error: "Failed to fetch alignment index" },
      { status: 500 }
    );
  }
}
