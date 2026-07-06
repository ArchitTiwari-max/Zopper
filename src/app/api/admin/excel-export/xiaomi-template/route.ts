import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
const MONTH_NAMES_SHORT = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function styleHeaderCell(
  cell: ExcelJS.Cell,
  bgArgb: string,
  fontArgb = "FFFFFFFF",
) {
  cell.font = { bold: true, color: { argb: fontArgb }, size: 11 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
  cell.border = {
    top:    { style: "thin", color: { argb: "FFD0D7DE" } },
    left:   { style: "thin", color: { argb: "FFD0D7DE" } },
    bottom: { style: "thin", color: { argb: "FFD0D7DE" } },
    right:  { style: "thin", color: { argb: "FFD0D7DE" } },
  };
}

function styleDataCell(cell: ExcelJS.Cell, opts?: { align?: "left" | "right" | "center"; locked?: boolean }) {
  cell.alignment = {
    horizontal: opts?.align ?? "left",
    vertical: "middle",
  };
  cell.border = {
    top:    { style: "thin", color: { argb: "FFE5E7EB" } },
    left:   { style: "thin", color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    right:  { style: "thin", color: { argb: "FFE5E7EB" } },
  };
  // Locked cells = grey tint to signal read-only
  if (opts?.locked) {
    cell.protection = { locked: true };
  }
}

// ────────────────────────────────────────────────────────────────
// GET /api/admin/excel-export/xiaomi-template
//
// Columns exported (4 only):
//   A: State          — locked (reference)
//   B: RetailerName   — locked (reference)
//   C: <month-label>  — locked (target already in DB, do not edit)
//   D: Achievement    — editable (admin fills/updates this)
//
// Query params:
//   month  = 1-12  (optional, defaults to current month)
//   year   = 4-digit year (optional, defaults to current year)
//   mode   = "template" | "export"
// ────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const prisma = new PrismaClient();
  try {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);
    const year  = parseInt(searchParams.get("year")  ?? String(now.getFullYear()), 10);
    const mode  = (searchParams.get("mode") ?? "template") as "template" | "export";

    // ── 1. Fetch Xiaomi brand ────────────────────────────────
    const xiaomiBrand = await prisma.brand.findFirst({
      where: { brandName: { equals: "Xiaomi", mode: "insensitive" } },
      select: { id: true },
    });

    if (!xiaomiBrand) {
      return new NextResponse(
        JSON.stringify({ error: "Xiaomi brand not found in database" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── 2. Fetch all Xiaomi stores ───────────────────────────
    const stores = await prisma.store.findMany({
      where: { storeCategory: "XIAOMI_TARGET" },
      select: { id: true, storeName: true, state: true },
      orderBy: [{ state: "asc" }, { storeName: "asc" }],
    });

    // ── 3. Fetch existing target + achievement for this month ─
    const targets = await prisma.storeTarget.findMany({
      where: {
        brandId: xiaomiBrand.id,
        month,
        year,
        storeId: { in: stores.map((s) => s.id) },
      },
      select: {
        storeId: true,
        targetRevenue: true,     // pre-filled, locked
        achievementRevenue: true, // editable
      },
    });

    await prisma.$disconnect();

    const targetMap = new Map(targets.map((t) => [t.storeId, t]));

    // ── 4. Build Excel ───────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SalesDost";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Xiaomi Targets", {
      // Sheet-level protection — State, RetailerName, Target cols will be locked
      // Achievement col is unlocked so admin can type freely
      properties: { defaultColWidth: 20 },
    });

    // Column widths  (only 4 cols now)
    ws.getColumn(1).width = 24; // State
    ws.getColumn(2).width = 38; // RetailerName
    ws.getColumn(3).width = 18; // Target (month label) — locked/reference
    ws.getColumn(4).width = 20; // Achievement — editable

    // Month label for the target column header (e.g. "Jul-26")
    const monthLabel = `${MONTH_NAMES_SHORT[month]}-${String(year).slice(-2)}`;

    // ── Header row ────────────────────────────────────────────
    const headerRow = ws.addRow([
      "State",
      "RetailerName",
      `${monthLabel} (Target)`,  // make it crystal-clear this is the target
      "Achievement",
    ]);
    headerRow.height = 30;

    // Col A & B: dark slate (reference / locked columns)
    styleHeaderCell(ws.getCell(1, 1), "FF374151", "FFFFFFFF");
    styleHeaderCell(ws.getCell(1, 2), "FF374151", "FFFFFFFF");
    // Col C: Xiaomi orange → this is the TARGET (read-only reference)
    styleHeaderCell(ws.getCell(1, 3), "FFFF6900", "FFFFFFFF");
    // Col D: bright green → this is the ACHIEVEMENT (editable)
    styleHeaderCell(ws.getCell(1, 4), "FF16A34A", "FFFFFFFF");

    // Freeze header row + first 2 cols for easy scrolling
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1, activeCell: "D2" }];

    // ── Data rows ─────────────────────────────────────────────
    let rowIdx = 2;
    for (const store of stores) {
      const t = targetMap.get(store.id);

      ws.addRow([
        store.state ?? "",
        store.storeName,
        t?.targetRevenue ?? "",       // Target (locked reference)
        t?.achievementRevenue ?? "",  // Achievement (admin edits this)
      ]);

      // ── Style cols A–B (locked reference, subtle grey bg) ──
      styleDataCell(ws.getCell(rowIdx, 1), { locked: true });
      styleDataCell(ws.getCell(rowIdx, 2), { locked: true });
      ws.getCell(rowIdx, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      ws.getCell(rowIdx, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      ws.getCell(rowIdx, 1).font = { color: { argb: "FF6B7280" }, size: 10 };
      ws.getCell(rowIdx, 2).font = { color: { argb: "FF374151" }, size: 10 };

      // ── Style col C (target — locked, orange tint bg) ──────
      styleDataCell(ws.getCell(rowIdx, 3), { align: "right", locked: true });
      ws.getCell(rowIdx, 3).fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: t?.targetRevenue != null ? "FFFFF3E0" : "FFFAFAFA" },
      };
      ws.getCell(rowIdx, 3).font = {
        color: { argb: t?.targetRevenue != null ? "FFB45309" : "FFD1D5DB" },
        size: 10,
        italic: t?.targetRevenue == null, // italic placeholder if empty
      };
      if (t?.targetRevenue == null) {
        ws.getCell(rowIdx, 3).value = "—"; // em dash if no target
      }

      // ── Style col D (achievement — editable, white/green bg) ─
      styleDataCell(ws.getCell(rowIdx, 4), { align: "right", locked: false });
      if (t?.achievementRevenue != null) {
        ws.getCell(rowIdx, 4).fill = {
          type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" },
        };
        ws.getCell(rowIdx, 4).font = { color: { argb: "FF15803D" }, size: 10 };
      } else {
        // Empty but clearly editable — white background
        ws.getCell(rowIdx, 4).fill = {
          type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" },
        };
        ws.getCell(rowIdx, 4).font = { color: { argb: "FF111827" }, size: 10 };
      }

      rowIdx++;
    }

    if (stores.length === 0) {
      ws.addRow(["UP", "Example Retailer Name", "—", ""]);
    }

    // ── Protect the sheet: lock col A, B, C — leave D open ───
    // (Protection password optional — empty string means no password needed)
    await ws.protect("", {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
    });

    // ── Summary note at bottom ────────────────────────────────
    ws.addRow([]);
    const infoRow = ws.addRow([
      `📊 Period: ${MONTH_NAMES_SHORT[month]}-${year}  |  Stores: ${stores.length}  |  Targets set: ${targets.filter((t) => t.targetRevenue != null).length}  |  With achievement: ${targets.filter((t) => t.achievementRevenue != null).length}  |  🟠 Orange col = Target (DO NOT EDIT)  |  🟢 Green col = Achievement (EDITABLE)`,
    ]);
    ws.getCell(infoRow.number, 1).font = { color: { argb: "FF9CA3AF" }, italic: true, size: 9 };
    ws.mergeCells(infoRow.number, 1, infoRow.number, 4);
    ws.getCell(infoRow.number, 1).alignment = { wrapText: true };
    ws.getRow(infoRow.number).height = 20;

    // ── Output ───────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const fileLabel = mode === "export" ? "xiaomi-export" : "xiaomi-template";
    const fileName  = `${fileLabel}-${monthLabel}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Xiaomi template export error:", error);
    await prisma.$disconnect();
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to export",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
