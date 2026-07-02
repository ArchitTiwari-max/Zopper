import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function getDateRange(range: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (range) {
    case "today": {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "last_year": {
      const from = new Date(now);
      from.setFullYear(now.getFullYear() - 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "last_90": {
      const from = new Date(now);
      from.setDate(now.getDate() - 90);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "last_30":
    default: {
      const from = new Date(now);
      from.setDate(now.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
  }
}

// GET endpoint to fetch visits of the authenticated executive's subordinates
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "EXECUTIVE") {
      return NextResponse.json(
        { error: "Access denied. Executive role required." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("range") || "last_30";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const { from, to } = getDateRange(dateRange);
    const skip = (page - 1) * PAGE_SIZE;

    // Fetch executive + subordinate IDs
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { id: true, subordinateIds: true },
    });

    if (!executive) {
      return NextResponse.json(
        { error: "Executive profile not found" },
        { status: 404 },
      );
    }

    const subordinateIds = executive.subordinateIds || [];
    console.log(`[Subordinate-Visits] User: ${user.userId}, Found Executive: ${executive.id}, Subordinate Count: ${subordinateIds.length}`);

    if (subordinateIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { total: 0, page, pageSize: PAGE_SIZE, totalPages: 0 },
      });
    }

    const visitDateFilter = { gte: from, lte: to };

    // Run physical + digital visit count and data queries in PARALLEL
    const [totalPhysical, totalDigital, visits, digitalVisits] =
      await Promise.all([
        prisma.visit.count({
          where: {
            executiveId: { in: subordinateIds },
            visitDate: visitDateFilter,
          },
        }),
        prisma.digitalVisit.count({
          where: {
            executiveId: { in: subordinateIds },
            connectDate: visitDateFilter,
          },
        }),
        prisma.visit.findMany({
          where: {
            executiveId: { in: subordinateIds },
            visitDate: visitDateFilter,
          },
          select: {
            id: true,
            status: true,
            personMet: true,
            POSMchecked: true,
            remarks: true,
            imageUrls: true,
            adminComment: true,
            brandVisitDetails: true,
            visitDate: true,
            createdAt: true,
            updatedAt: true,
            reviewedByAdmin: { select: { name: true } },
            store: {
              select: {
                id: true,
                storeName: true,
                city: true,
                storeBrands: { select: { brandId: true, brandType: true } },
              },
            },
            executive: { select: { name: true } },
            issues: {
              select: {
                id: true,
                details: true,
                status: true,
                createdAt: true,
                assigned: {
                  select: {
                    id: true,
                    adminComment: true,
                    status: true,
                    createdAt: true,
                    executive: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: { visitDate: "desc" },
        }),
        prisma.digitalVisit.findMany({
          where: {
            executiveId: { in: subordinateIds },
            connectDate: visitDateFilter,
          },
          select: {
            id: true,
            status: true,
            personMet: true,
            remarks: true,
            adminComment: true,
            brandVisitDetails: true,
            connectDate: true,
            createdAt: true,
            updatedAt: true,
            reviewedByAdmin: { select: { name: true } },
            store: {
              select: {
                id: true,
                storeName: true,
                city: true,
                storeBrands: { select: { brandId: true, brandType: true } },
              },
            },
            executive: { select: { name: true } },
            issues: {
              select: {
                id: true,
                details: true,
                status: true,
                createdAt: true,
                assigned: {
                  select: {
                    id: true,
                    adminComment: true,
                    status: true,
                    createdAt: true,
                    executive: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: { connectDate: "desc" },
        }),
      ]);

    // Collect all unique brand IDs, then fetch brand names in a single query
    const allBrandIds = [
      ...new Set([
        ...visits.flatMap(
          (v) => v.store?.storeBrands.map((sb) => sb.brandId) || [],
        ),
        ...digitalVisits.flatMap(
          (v) => v.store?.storeBrands.map((sb) => sb.brandId) || [],
        ),
      ]),
    ];

    const brands =
      allBrandIds.length > 0
        ? await prisma.brand.findMany({
            where: { id: { in: allBrandIds } },
            select: { id: true, brandName: true },
          })
        : [];

    const brandMap = new Map(brands.map((b) => [b.id, b.brandName]));

    const BRAND_TYPE_LABELS: Record<string, string> = {
      A_PLUS: "A+",
      A: "A",
      B: "B",
      C: "C",
      D: "D",
    };

    const getBrandString = (
      storeBrands: { brandId: string; brandType?: string | null }[],
    ) =>
      storeBrands.length > 0
        ? storeBrands
            .map((sb) => {
              const brandName = brandMap.get(sb.brandId) || "Unknown Brand";
              const category =
                sb.brandType && sb.brandType !== "NONE"
                  ? ` (${BRAND_TYPE_LABELS[sb.brandType] || sb.brandType})`
                  : "";
              return `${brandName}${category}`;
            })
            .join(", ")
        : "N/A";

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

    const transformedPhysical = visits.map((visit) => ({
      id: visit.id,
      type: "Physical" as const,
      storeId: visit.store?.id || "",
      storeName: visit.store?.storeName || "Unknown Store",
      city: visit.store?.city || "",
      partnerBrand: getBrandString(visit.store?.storeBrands || []),
      status: visit.status,
      reviewerName: visit.reviewedByAdmin?.name,
      representative: visit.executive?.name || "Unknown Executive",
      personMet: visit.personMet,
      POSMchecked: visit.POSMchecked,
      remarks: visit.remarks,
      imageUrls: visit.imageUrls,
      adminComment: visit.adminComment,
      brandVisitDetails: visit.brandVisitDetails || null,
      issues: visit.issues || [],
      date: formatDate(visit.visitDate || visit.createdAt),
      visitDate: visit.visitDate || visit.createdAt,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    }));

    const transformedDigital = digitalVisits.map((visit) => ({
      id: visit.id,
      type: "Digital" as const,
      storeId: visit.store?.id || "",
      storeName: visit.store?.storeName || "Unknown Store",
      city: visit.store?.city || "",
      partnerBrand: getBrandString(visit.store?.storeBrands || []),
      status: visit.status,
      reviewerName: visit.reviewedByAdmin?.name,
      representative: visit.executive?.name || "Unknown Executive",
      personMet: visit.personMet,
      POSMchecked: null,
      remarks: visit.remarks,
      imageUrls: [],
      adminComment: visit.adminComment,
      brandVisitDetails: visit.brandVisitDetails || null,
      issues: visit.issues || [],
      date: formatDate(visit.connectDate || visit.createdAt),
      visitDate: visit.connectDate || visit.createdAt,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    }));

    // Merge, sort by most recent, then paginate
    const allVisits = [...transformedPhysical, ...transformedDigital].sort(
      (a, b) =>
        new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime(),
    );

    const total = totalPhysical + totalDigital;
    const paginated = allVisits.slice(skip, skip + PAGE_SIZE);

    const response = NextResponse.json({
      success: true,
      data: paginated,
      pagination: {
        total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });

    // Prevent browser caching to avoid seeing previous user's data after relogin
    response.headers.set(
      "Cache-Control",
      "no-store, max-age=0",
    );

    return response;
  } catch (error: any) {
    console.error("Error fetching subordinate visits:", error);
    return NextResponse.json(
      { error: "Failed to fetch subordinate visits", details: error.message },
      { status: 500 },
    );
  }
}
