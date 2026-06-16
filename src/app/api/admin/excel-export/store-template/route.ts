import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

// Helper to apply header cell style
function styleHeaderCell(
  cell: ExcelJS.Cell,
  bgColor: string,
  fontColor = 'FFFFFFFF'
) {
  cell.font = { bold: true, color: { argb: fontColor }, size: 11 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FFD0D7DE' } },
    left:   { style: 'thin', color: { argb: 'FFD0D7DE' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
    right:  { style: 'thin', color: { argb: 'FFD0D7DE' } },
  };
}

export async function GET() {
  try {
    const prisma = new PrismaClient();

    // Fetch all brands
    const brands = await prisma.brand.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: 'asc' }
    });

    await prisma.$disconnect();

    // Use first 2 brands as example columns (or all if fewer)
    const exampleBrands = brands.slice(0, Math.min(2, brands.length));

    // Column layout
    const fixedHeaders   = ['Store_ID', 'Store Name', 'City', 'Full Address', 'Latitude', 'Longitude'];
    const trailingHeaders = [
      'Store Category', 'Store Channel',
      'City Tier', 'State', 'Priority', 'Executive_IDs', "POC's Name"
    ];
    const COLS_PER_BRAND = 3; // ZopperBrandId | StoreBrandId | BrandType
    const numFixed    = fixedHeaders.length;
    const numBrands   = exampleBrands.length;
    const numTrailing = trailingHeaders.length;

    // ---- Create workbook & worksheet ----
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Store Import Template');

    // ---- Set column widths ----
    const fixedWidths    = [15, 35, 20, 40, 15, 15];
    const trailingWidths = [15, 15, 15, 15, 10, 35, 35];
    fixedWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    exampleBrands.forEach((_, i) => {
      ws.getColumn(numFixed + i * COLS_PER_BRAND + 1).width = 22; // ZopperBrandId
      ws.getColumn(numFixed + i * COLS_PER_BRAND + 2).width = 20; // StoreBrandId
      ws.getColumn(numFixed + i * COLS_PER_BRAND + 3).width = 15; // BrandType
    });
    trailingWidths.forEach((w, i) => {
      ws.getColumn(numFixed + numBrands * COLS_PER_BRAND + i + 1).width = w;
    });

    // ---- Header Row 1 ----
    const row1Values: (string | null)[] = [
      ...fixedHeaders,
      ...exampleBrands.flatMap(b => [b.brandName, null, null]),
      ...trailingHeaders
    ];
    const row1 = ws.addRow(row1Values);
    row1.height = 28;

    // ---- Header Row 2 ----
    const row2Values: (string | null)[] = [
      ...fixedHeaders.map(() => null),
      ...exampleBrands.flatMap(() => ['ZopperBrandId', 'StoreBrandId', 'BrandType']),
      ...trailingHeaders.map(() => null)
    ];
    const row2 = ws.addRow(row2Values);
    row2.height = 24;

    // ---- Merges ----
    for (let c = 1; c <= numFixed; c++) {
      ws.mergeCells(1, c, 2, c);
    }
    for (let i = 0; i < numBrands; i++) {
      const c = numFixed + i * COLS_PER_BRAND + 1;
      ws.mergeCells(1, c, 1, c + COLS_PER_BRAND - 1);
    }
    for (let i = 0; i < numTrailing; i++) {
      const c = numFixed + numBrands * COLS_PER_BRAND + i + 1;
      ws.mergeCells(1, c, 2, c);
    }

    // ---- Style Row 1 cells ----
    for (let c = 1; c <= numFixed; c++) {
      styleHeaderCell(ws.getCell(1, c), 'FF1E3A5F');
    }
    for (let i = 0; i < numBrands; i++) {
      const c = numFixed + i * COLS_PER_BRAND + 1;
      styleHeaderCell(ws.getCell(1, c), 'FF0D6E8A');
    }
    for (let i = 0; i < numTrailing; i++) {
      const c = numFixed + numBrands * COLS_PER_BRAND + i + 1;
      styleHeaderCell(ws.getCell(1, c), 'FF1E3A5F');
    }

    // ---- Style Row 2 sub-header cells ----
    for (let i = 0; i < numBrands; i++) {
      const c1 = numFixed + i * COLS_PER_BRAND + 1;
      styleHeaderCell(ws.getCell(2, c1),     'FF1A8FAD'); // ZopperBrandId
      styleHeaderCell(ws.getCell(2, c1 + 1), 'FF1A8FAD'); // StoreBrandId
      styleHeaderCell(ws.getCell(2, c1 + 2), 'FF1A8FAD'); // BrandType
    }

    // ---- Sample data row ----
    const brandSampleData = exampleBrands.flatMap(b => [b.id, 'SB-001', 'A+']);
    ws.addRow([
      'STORE_001',
      'Example Store Name',
      'Mumbai',
      'Plot No. 1, Example Street, Mumbai, MH',
      19.076,
      72.8777,
      ...brandSampleData,
      'LFR',
      'Offline',
      'Tier 1',
      'Maharashtra',
      'p1',
      'executive_001, executive_002',
      'John Doe, Jane Smith'
    ]);

    // Freeze only the top 2 header rows (no column freeze)
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }];

    // ---- Brand Reference sheet ----
    const wsBrands = workbook.addWorksheet('Brand Reference');
    wsBrands.getColumn(1).width = 20;
    wsBrands.getColumn(2).width = 25;

    const brandRefHeader = wsBrands.addRow(['Brand ID', 'Brand Name']);
    brandRefHeader.height = 22;
    brandRefHeader.eachCell(cell => {
      styleHeaderCell(cell, 'FF1E3A5F');
    });

    brands.forEach(b => {
      wsBrands.addRow([b.id, b.brandName]);
    });

    // ---- Generate buffer & return ----
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="store-import-template-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Store template generation error:', error);
    return new NextResponse(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate store template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
