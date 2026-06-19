import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function styleHeaderCell(
  cell: ExcelJS.Cell,
  bgColor: string,
  fontColor = "FFFFFFFF",
) {
  cell.font = { bold: true, color: { argb: fontColor }, size: 11 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
  cell.border = {
    top: { style: "thin", color: { argb: "FFD0D7DE" } },
    left: { style: "thin", color: { argb: "FFD0D7DE" } },
    bottom: { style: "thin", color: { argb: "FFD0D7DE" } },
    right: { style: "thin", color: { argb: "FFD0D7DE" } },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandParam = searchParams.get("brand");
    const monthParam = searchParams.get("month"); // Expecting format "MM-YYYY", e.g. "06-2026"
    const prisma = new PrismaClient();

    // Determine target month and year
    let year: number;
    let month: number;
    if (monthParam && /^\d{2}-\d{4}$/.test(monthParam)) {
      [month, year] = monthParam.split("-").map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    // Fetch store-brand mappings (only those with storeBrandId configured)
    let storeBrands: {
      storeId: string;
      brandId: string;
      storeBrandId: string | null;
    }[] = [];
    if (brandParam) {
      const brand = await prisma.brand.findFirst({
        where: {
          OR: [
            { id: { equals: brandParam, mode: "insensitive" } },
            { brandName: { contains: brandParam, mode: "insensitive" } },
          ],
        },
      });
      if (brand) {
        storeBrands = await prisma.storeBrand.findMany({
          where: { brandId: brand.id, storeBrandId: { not: null } },
          select: { storeId: true, brandId: true, storeBrandId: true },
          orderBy: [{ storeId: "asc" }, { brandId: "asc" }],
        });
      }
    } else {
      storeBrands = await prisma.storeBrand.findMany({
        where: { storeBrandId: { not: null } },
        select: { storeId: true, brandId: true, storeBrandId: true },
        orderBy: [{ storeId: "asc" }, { brandId: "asc" }],
      });
    }

    // Fetch active categories
    const categories = await prisma.productCategory.findMany({
      select: { id: true, categoryName: true },
      orderBy: { categoryName: "asc" },
    });

    // Query existing targets for this month/year to pre-fill
    const targets = await prisma.storeTarget.findMany({
      where: { month, year },
      select: {
        storeId: true,
        brandId: true,
        productCategoryId: true,
        targetRevenue: true,
        targetUnits: true,
      },
    });

    await prisma.$disconnect();

    const targetMap = new Map<
      string,
      { targetRevenue: number | null; targetUnits: number | null }
    >();
    targets.forEach((t) => {
      targetMap.set(
        `${t.storeId.toUpperCase()}_${t.brandId.toUpperCase()}_${t.productCategoryId.toUpperCase()}`,
        {
          targetRevenue: t.targetRevenue,
          targetUnits: t.targetUnits,
        },
      );
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Store Targets Template");

    // Define column dimensions
    ws.getColumn(1).width = 24; // StoreBrand_ID
    ws.getColumn(2).width = 20; // Category
    ws.getColumn(3).width = 12; // Month
    ws.getColumn(4).width = 12; // Year
    ws.getColumn(5).width = 18; // Target_Revenue
    ws.getColumn(6).width = 15; // Target_Units

    // Header row
    const headers = [
      "StoreBrand_ID",
      "Product Category",
      "Month",
      "Year",
      "Target_Revenue",
      "Target_Units",
    ];
    const headerRow = ws.addRow(headers);
    headerRow.height = 28;

    // Style header row cells
    for (let c = 1; c <= headers.length; c++) {
      styleHeaderCell(ws.getCell(1, c), "FF1E3A5F"); // Premium Deep Navy Blue
    }

    // Freeze header
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }];

    // Populate lines
    if (storeBrands.length > 0 && categories.length > 0) {
      storeBrands.forEach((sb) => {
        if (!sb.storeBrandId) return;
        categories.forEach((cat) => {
          const key = `${sb.storeId.toUpperCase()}_${sb.brandId.toUpperCase()}_${cat.id.toUpperCase()}`;
          const existing = targetMap.get(key);
          ws.addRow([
            sb.storeBrandId,
            cat.categoryName,
            month,
            year,
            existing?.targetRevenue ?? "",
            existing?.targetUnits ?? "",
          ]);
        });
      });
    } else {
      // Fallback/Sample
      ws.addRow(["SB_EXAMPLE", "Smartphone", month, year, "", ""]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const monthStr = `${String(month).padStart(2, "0")}-${year}`;

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="store-targets-template-${monthStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Store target template export error:", error);
    return new NextResponse(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to export target template",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
