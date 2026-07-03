import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    const prisma = new PrismaClient();

    // Fetch all stores with their executives, storeBrands and visit counts
    const stores = await prisma.store.findMany({
      include: {
        employeeStores: {
          include: {
            employee: { select: { id: true, name: true } }
          }
        },
        storeBrands: { select: { brandId: true, storeBrandId: true, brandType: true } },
        _count: { select: { visits: true } }
      },
      orderBy: { id: 'asc' }
    });

    // Fetch all brands
    const brands = await prisma.brand.findMany({
      select: { id: true, brandName: true }
    });
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    await prisma.$disconnect();

    // All brands from DB sorted by name (regardless of store assignment)
    const sortedBrands = brands
      .map(b => ({ id: b.id, name: b.brandName }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Column counts
    const fixedHeaders   = ['Store_ID', 'Store Name', 'City', 'Full Address', 'Latitude', 'Longitude'];
    const trailingHeaders = [
      'Store Category', 'Store Channel',
      'City Tier', 'State', 'Priority', 'Executive_IDs', "POC's Name", 'Number of Visits'
    ];
    const COLS_PER_BRAND = 3; // ZopperBrandId | StoreBrandId | BrandType
    const numFixed    = fixedHeaders.length;   // 6
    const numBrands   = sortedBrands.length;
    const numTrailing = trailingHeaders.length; // 8

    // ---- Create workbook & worksheet ----
    const workbook  = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Stores');

    // ---- Set column widths ----
    const fixedWidths    = [15, 35, 20, 30, 15, 15];
    const trailingWidths = [15, 15, 15, 15, 15, 40, 40, 20];
    fixedWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    sortedBrands.forEach((_, i) => {
      ws.getColumn(numFixed + i * COLS_PER_BRAND + 1).width = 22; // ZopperBrandId
      ws.getColumn(numFixed + i * COLS_PER_BRAND + 2).width = 20; // StoreBrandId
      ws.getColumn(numFixed + i * COLS_PER_BRAND + 3).width = 15; // BrandType
    });
    trailingWidths.forEach((w, i) => {
      ws.getColumn(numFixed + numBrands * COLS_PER_BRAND + i + 1).width = w;
    });

    // ---- Header Row 1: fixed labels | brand names (span 3) | trailing labels ----
    const row1Values: (string | null)[] = [
      ...fixedHeaders,
      ...sortedBrands.flatMap(b => [b.name, null, null]),
      ...trailingHeaders
    ];
    const row1 = ws.addRow(row1Values);
    row1.height = 28;

    // ---- Header Row 2: empty | ZopperBrandId / StoreBrandId / BrandType per brand | empty ----
    const row2Values: (string | null)[] = [
      ...fixedHeaders.map(() => null),
      ...sortedBrands.flatMap(() => ['ZopperBrandId', 'StoreBrandId', 'BrandType']),
      ...trailingHeaders.map(() => null)
    ];
    const row2 = ws.addRow(row2Values);
    row2.height = 24;

    // ---- Merges ----
    // Fixed cols: merge rows 1-2 vertically
    for (let c = 1; c <= numFixed; c++) {
      ws.mergeCells(1, c, 2, c);
    }
    // Brand cols: merge brand name horizontally across 3 cols in row 1
    for (let i = 0; i < numBrands; i++) {
      const c = numFixed + i * COLS_PER_BRAND + 1;
      ws.mergeCells(1, c, 1, c + COLS_PER_BRAND - 1);
    }
    // Trailing cols: merge rows 1-2 vertically
    for (let i = 0; i < numTrailing; i++) {
      const c = numFixed + numBrands * COLS_PER_BRAND + i + 1;
      ws.mergeCells(1, c, 2, c);
    }

    // ---- Style Row 1 header cells ----
    // Fixed: dark navy
    for (let c = 1; c <= numFixed; c++) {
      styleHeaderCell(ws.getCell(1, c), 'FF1E3A5F');
    }
    // Brand name headers: teal
    for (let i = 0; i < numBrands; i++) {
      const c = numFixed + i * COLS_PER_BRAND + 1;
      styleHeaderCell(ws.getCell(1, c), 'FF0D6E8A');
    }
    // Trailing headers: dark navy
    for (let i = 0; i < numTrailing; i++) {
      const c = numFixed + numBrands * COLS_PER_BRAND + i + 1;
      styleHeaderCell(ws.getCell(1, c), 'FF1E3A5F');
    }

    // ---- Style Row 2 sub-header cells (ZopperBrandId / StoreBrandId / BrandType) ----
    for (let i = 0; i < numBrands; i++) {
      const c1 = numFixed + i * COLS_PER_BRAND + 1;
      styleHeaderCell(ws.getCell(2, c1),     'FF1A8FAD'); // ZopperBrandId
      styleHeaderCell(ws.getCell(2, c1 + 1), 'FF1A8FAD'); // StoreBrandId
      styleHeaderCell(ws.getCell(2, c1 + 2), 'FF1A8FAD'); // BrandType
    }

    // ---- Data Rows ----
    stores.forEach(store => {
      const storeBrandMap = new Map(
        store.storeBrands.map(sb => [sb.brandId, sb])
      );
      const brandData = sortedBrands.flatMap(brand => {
        const sb = storeBrandMap.get(brand.id);
        const isPresent = !!sb;
        const type = sb?.brandType || '';
        return [
          isPresent ? brand.id : '',                                            // ZopperBrandId
          isPresent ? (sb?.storeBrandId || '') : '',                            // StoreBrandId
          (isPresent && type && type !== 'NONE') ? type : ''                    // BrandType
        ];
      });
      ws.addRow([
        store.id,
        store.storeName,
        store.city || '',
        store.fullAddress || '',
        store.latitude ?? '',
        store.longitude ?? '',
        ...brandData,
        store.storeCategory || '',
        store.storeChannel || '',
        store.cityTier || '',
        store.state || '',
        store.priority || '',
        store.employeeStores.map(es => es.employee.id).join(', '),
        store.employeeStores.map(es => es.employee.name).join(', '),
        store._count.visits
      ]);
    });

    // Freeze only the top 2 header rows (no column freeze)
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }];

    // ---- Generate buffer & return ----
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stores-export-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Store export error:', error);
    return new NextResponse(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to export stores' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
