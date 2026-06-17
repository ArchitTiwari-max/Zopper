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
    const monthParam = searchParams.get("month"); // optional: "06-2026"
    const prisma = new PrismaClient();

    let storeBrands: {
      storeBrandId: string | null;
      store: { storeName: string };
    }[] = [];
    let categories: { id: string; categoryName: string }[] = [];

    // Always fetch categories
    categories = await prisma.category.findMany({
      select: { id: true, categoryName: true },
      orderBy: { categoryName: "asc" },
    });

    if (brandParam && brandParam !== "ALL") {
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
          select: {
            storeBrandId: true,
            store: { select: { storeName: true } },
          },
          orderBy: { storeBrandId: "asc" },
        });
      }
    } else {
      storeBrands = await prisma.storeBrand.findMany({
        where: { storeBrandId: { not: null } },
        select: { storeBrandId: true, store: { select: { storeName: true } } },
        orderBy: { storeBrandId: "asc" },
      });
    }

    await prisma.$disconnect();

    // Determine target month
    let year: number;
    let month: number;
    if (monthParam && /^\d{2}-\d{4}$/.test(monthParam)) {
      [month, year] = monthParam.split("-").map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const dates: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      dates.push(
        `${String(d).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`,
      );
    }

    // ---- Workbook setup ----
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Daily Sales Template");

    // Column widths
    ws.getColumn(1).width = 22; // StoreBrand_ID
    ws.getColumn(2).width = 15; // Category
    for (let i = 0; i < dates.length; i++) {
      ws.getColumn(3 + i * 2).width = 16; // Count of Sales
      ws.getColumn(4 + i * 2).width = 14; // Revenue
    }

    // ---- Row 1: merged headers ----
    const row1Values: (string | null)[] = [
      "StoreBrand_ID",
      "Category",
      ...dates.flatMap((d) => [d, null]),
    ];
    const row1 = ws.addRow(row1Values);
    row1.height = 28;

    // ---- Row 2: sub-headers ----
    const row2Values: (string | null)[] = [
      null,
      null,
      ...dates.flatMap(() => ["Count of Sales", "Revenue"]),
    ];
    const row2 = ws.addRow(row2Values);
    row2.height = 24;

    // ---- Merges ----
    ws.mergeCells(1, 1, 2, 1); // StoreBrand_ID spans both rows
    ws.mergeCells(1, 2, 2, 2); // Category spans both rows
    for (let i = 0; i < dates.length; i++) {
      const col = 3 + i * 2;
      ws.mergeCells(1, col, 1, col + 1); // date header spans Count of Sales + Revenue
    }

    // ---- Style row 1 ----
    styleHeaderCell(ws.getCell(1, 1), "FF1E3A5F");
    styleHeaderCell(ws.getCell(1, 2), "FF1E3A5F");
    for (let i = 0; i < dates.length; i++) {
      styleHeaderCell(ws.getCell(1, 3 + i * 2), "FF0D6E8A");
    }

    // ---- Style row 2 sub-headers ----
    for (let i = 0; i < dates.length; i++) {
      styleHeaderCell(ws.getCell(2, 3 + i * 2), "FF1A8FAD");
      styleHeaderCell(ws.getCell(2, 3 + i * 2 + 1), "FF1A8FAD");
    }

    // Freeze first 2 rows and first 2 columns
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 2, activeCell: "C3" }];

    // ---- Data rows: one per storeBrandId ----
    if (storeBrands.length > 0) {
      for (const sb of storeBrands) {
        if (sb.storeBrandId) {
          ws.addRow([sb.storeBrandId, "", ...Array(dates.length * 2).fill("")]);
        }
      }
    } else {
      // Fallback sample row if brand not found
      ws.addRow(["SB-EXAMPLE-001", "", ...Array(dates.length * 2).fill("")]);
    }

    // ---- Category Reference sheet ----
    if (categories.length > 0) {
      const wsCat = workbook.addWorksheet("Category Reference");
      wsCat.getColumn(1).width = 30;
      const catHeader = wsCat.addRow(["Category Name"]);
      catHeader.height = 22;
      styleHeaderCell(wsCat.getCell(1, 1), "FF1E3A5F");
      categories.forEach((c) => {
        wsCat.addRow([c.categoryName]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const monthStr = `${String(month).padStart(2, "0")}-${year}`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="daily-sales-template-${brandParam || "ALL"}-${monthStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Daily sales template generation error:", error);
    return new NextResponse(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate template",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
