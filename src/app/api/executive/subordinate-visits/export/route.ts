import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

const RANGE_LABELS: Record<string, string> = {
  today: "Today",
  last_30: "Last 30 Days",
  last_year: "Last Year",
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "EXECUTIVE")
      return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("range") || "last_30";
    const visitType = searchParams.get("type") || "all"; // 'Physical' | 'Digital' | 'all'
    const executiveName = searchParams.get("executive") || "All";

    const { from, to } = getDateRange(dateRange);

    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { id: true, subordinateIds: true },
    });

    if (!executive)
      return NextResponse.json(
        { error: "Executive not found" },
        { status: 404 },
      );

    const subordinateIds = executive.subordinateIds || [];
    if (subordinateIds.length === 0) {
      return NextResponse.json(
        { error: "No subordinates found" },
        { status: 404 },
      );
    }

    const subordinates = await prisma.executive.findMany({
      where: { id: { in: subordinateIds } },
      select: { id: true, name: true },
    });

    const visitDateFilter = { gte: from, lte: to };

    // Determine which subordinate IDs to filter by if specific executive selected
    let filteredSubIds = subordinateIds;
    if (executiveName !== "All") {
      const matched = subordinates.find(
        (s) =>
          s.name === executiveName || s.name.split(" ")[0] === executiveName,
      );
      if (matched) {
        filteredSubIds = [matched.id];
      } else {
        filteredSubIds = [];
      }
    }

    const [visits, digitalVisits] = await Promise.all([
      visitType === "Digital"
        ? Promise.resolve([])
        : prisma.visit.findMany({
            where: {
              executiveId: { in: filteredSubIds },
              visitDate: visitDateFilter,
            },
            select: {
              id: true,
              status: true,
              personMet: true,
              POSMchecked: true,
              remarks: true,
              visitDate: true,
              createdAt: true,
              reviewedByAdmin: { select: { name: true } },
              store: {
                select: {
                  id: true,
                  storeName: true,
                  storeBrands: { select: { brandId: true } },
                },
              },
              executive: { select: { name: true } },
              issues: { select: { id: true, details: true, status: true } },
            },
            orderBy: { visitDate: "desc" },
          }),
      visitType === "Physical"
        ? Promise.resolve([])
        : prisma.digitalVisit.findMany({
            where: {
              executiveId: { in: filteredSubIds },
              connectDate: visitDateFilter,
            },
            select: {
              id: true,
              status: true,
              personMet: true,
              remarks: true,
              connectDate: true,
              createdAt: true,
              reviewedByAdmin: { select: { name: true } },
              store: {
                select: {
                  id: true,
                  storeName: true,
                  storeBrands: { select: { brandId: true } },
                },
              },
              executive: { select: { name: true } },
              issues: { select: { id: true, details: true, status: true } },
            },
            orderBy: { connectDate: "desc" },
          }),
    ]);

    // Brand lookup
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
    const getBrandString = (sb: { brandId: string }[]) =>
      sb.length > 0
        ? sb.map((s) => brandMap.get(s.brandId) || "Unknown").join(", ")
        : "N/A";

    const formatDate = (d: Date) => {
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const formatPeopleMet = (personMet: any): string => {
      if (!personMet || !Array.isArray(personMet)) return "";
      return personMet
        .map(
          (p: any) =>
            `${p.name}${p.designation ? ` (${p.designation})` : ""}${p.phoneNumber ? ` - ${p.phoneNumber}` : ""}`,
        )
        .join("; ");
    };

    // Build rows
    const rows = [
      ...visits.map((v) => ({
        Type: "Physical",
        Executive: v.executive?.name || "",
        "Store Name": v.store?.storeName || "",
        "Partner Brands": getBrandString(v.store?.storeBrands || []),
        "Visit Date": formatDate(v.visitDate || v.createdAt),
        Status: v.status,
        "POSM Available":
          v.POSMchecked === null ? "N/A" : v.POSMchecked ? "Yes" : "No",
        "People Met": formatPeopleMet(v.personMet),
        Remarks: v.remarks || "",
        "Issues Count": v.issues?.length || 0,
        "Issue Details":
          v.issues?.map((i: any) => `${i.details} [${i.status}]`).join("; ") ||
          "",
        "Reviewed By": v.reviewedByAdmin?.name || "Pending",
      })),
      ...digitalVisits.map((v) => ({
        Type: "Digital",
        Executive: v.executive?.name || "",
        "Store Name": v.store?.storeName || "",
        "Partner Brands": getBrandString(v.store?.storeBrands || []),
        "Visit Date": formatDate(v.connectDate || v.createdAt),
        Status: v.status,
        "POSM Available": "N/A",
        "People Met": formatPeopleMet(v.personMet),
        Remarks: v.remarks || "",
        "Issues Count": v.issues?.length || 0,
        "Issue Details":
          v.issues?.map((i: any) => `${i.details} [${i.status}]`).join("; ") ||
          "",
        "Reviewed By": v.reviewedByAdmin?.name || "Pending",
      })),
    ].sort((a, b) => {
      const da = new Date(
        a["Visit Date"].split("/").reverse().join("-"),
      ).getTime();
      const db = new Date(
        b["Visit Date"].split("/").reverse().join("-"),
      ).getTime();
      return db - da;
    });

    // Build workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto column widths
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...rows.map((r) => String((r as any)[key] || "").length).slice(0, 50),
      ),
    }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Subordinate Visits");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const typeLabel = visitType === "all" ? "All" : visitType;
    const rangeLabel = RANGE_LABELS[dateRange] || dateRange;
    const filename = `SubordinateVisits_${typeLabel}_${rangeLabel.replace(/ /g, "_")}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error.message },
      { status: 500 },
    );
  }
}
