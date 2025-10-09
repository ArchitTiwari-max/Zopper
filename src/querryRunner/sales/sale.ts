import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function postSales(rowObj: Record<string, any>, storeCount: number): Promise<string> {
  try {
    const { Store_ID, Brand, Category, ...monthMetrics } = rowObj;
    const context = `Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
    if (!Store_ID || !Brand || !Category) {
      return `❌ Missing Store_ID, Brand, or Category. ${context}`;
    }

    const store = await prisma.store.findUnique({ where: { id: Store_ID } });
    if (!store) return `Store not found. ${context}`;
    const brand = await prisma.brand.findUnique({ where: { brandName: Brand } });
    if (!brand) return `Brand not found. ${context}`;
    const category = await prisma.category.findUnique({ where: { categoryName: Category } });
    if (!category) return `Category not found. ${context}`;
    if (!store.partnerBrandIds.includes(brand.id)) {
      return `❌ Brand is not mapped to this store. ${context}`;
    }
    const catBrand = await prisma.categoryBrand.findUnique({
      where: { brandId_categoryId: { brandId: brand.id, categoryId: category.id } }
    });
    if (!catBrand) {
      return `❌ Category is not mapped to this brand. ${context}`;
    }

    const salesByYear: Record<number, any[]> = {};
    for (const key in monthMetrics) {
      const match = key.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4}) (.+)$/);
      if (!match) continue;
      const [_, dd, mm, yyyy, metric] = match;
      const year = parseInt(yyyy, 10);
      const month = parseInt(mm, 10);
      if (!salesByYear[year]) salesByYear[year] = [];
      let entry = salesByYear[year].find(e => e.month === month);
      if (!entry) {
        entry = { month };
        salesByYear[year].push(entry);
      }
      if (/device sales/i.test(metric)) entry.deviceSales = monthMetrics[key] || 0;
      if (/plan sales/i.test(metric)) entry.planSales = monthMetrics[key] || 0;
      if (/attach ?%/i.test(metric)) entry.attachPct = monthMetrics[key] || 0;
      if (/revenue/i.test(metric)) entry.revenue = monthMetrics[key] || 0;
    }

    // Helper function to merge monthly sales data (preserve existing months)
    const mergeMonthlySales = (existing: any[] | null | undefined, incoming: any[]): any[] => {
      const result = new Map<number, any>();
      
      // First, preserve all existing months
      if (existing && Array.isArray(existing)) {
        for (const monthData of existing) {
          if (monthData && typeof monthData.month === 'number') {
            result.set(monthData.month, { ...monthData });
          }
        }
      }
      
      // Then, merge in the new data (overwrites same months, adds new months)
      for (const monthData of incoming) {
        if (monthData && typeof monthData.month === 'number') {
          result.set(monthData.month, { ...monthData });
        }
      }
      
      // Convert back to array and sort by month
      return Array.from(result.values()).sort((a, b) => a.month - b.month);
    };

    for (const yearStr in salesByYear) {
      const year = parseInt(yearStr, 10);
      const incomingMonthlySales = salesByYear[year];
      
      const key = {
        storeId_brandId_categoryId_year: {
          storeId: Store_ID,
          brandId: brand.id,
          categoryId: category.id,
          year,
        },
      };
      
      // Read existing record to merge monthly sales instead of overwriting
      const existing = await prisma.salesRecord.findUnique({
        where: key,
        select: { monthlySales: true }
      });
      
      // Merge existing monthly sales with incoming data
      const mergedMonthlySales = mergeMonthlySales(
        existing?.monthlySales as any[] | null,
        incomingMonthlySales
      );
      
      await prisma.salesRecord.upsert({
        where: key,
        update: { monthlySales: mergedMonthlySales },
        create: {
          storeId: Store_ID,
          brandId: brand.id,
          categoryId: category.id,
          year,
          monthlySales: mergedMonthlySales,
          dailySales: [],
        },
      });
    }
    return `✅ Sales data stored successfully for ${context}. Total stores pushed: ${storeCount}`;
  } catch (err) {
    console.error(err);
    const { Store_ID, Brand, Category } = rowObj;
    return `❌ Internal server error for Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
  }
}


function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30 + serial));
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function main() {
  const workbook = XLSX.readFile('src/querryRunner/sales/sale.xlsx');
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']!);

  const firstHeaderRow: any[] = [];
  const secondHeaderRow: any[] = [];
  let lastBaseHeader = '';
  for (let c = range.s.c; c <= range.e.c; ++c) {
    let baseHeader = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v;
    const subHeader = ws[XLSX.utils.encode_cell({ r: range.s.r + 1, c })]?.v || '';
    if (typeof baseHeader === 'number' && baseHeader > 40000) {
      baseHeader = formatDate(excelSerialToDate(baseHeader));
    }
    if (baseHeader instanceof Date) {
      baseHeader = formatDate(baseHeader);
    }
    if (!baseHeader) baseHeader = lastBaseHeader;
    else lastBaseHeader = baseHeader;
    firstHeaderRow.push(baseHeader || '');
    secondHeaderRow.push(subHeader);
  }

  const keepFields = ['Store_ID', 'Brand', 'Category'];
  let totalRows = 0;
  let successful = 0;
  let failed = 0;
  const errorLogs: string[] = [];

  try {
    for (let r = range.s.r + 2; r <= range.e.r; ++r) {
      totalRows++;
      try {
        const rowObj: Record<string, any> = {};
        for (let c = range.s.c; c <= range.e.c; ++c) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          const baseHeader = firstHeaderRow[c - range.s.c];
          const subHeader = secondHeaderRow[c - range.s.c];
          if (keepFields.includes(baseHeader)) {
            rowObj[baseHeader] = cell ? cell.v : null;
          } else if (baseHeader && subHeader) {
            rowObj[`${baseHeader} ${subHeader}`] = cell ? cell.v : null;
          }
        }
        const message = await postSales(rowObj, successful + 1); // Pass next success count
        if (message.startsWith('✅ Sales data stored successfully')) {
          successful++;
        } else {
          failed++;
          errorLogs.push(message);
        }
        console.log(message);
      } catch (err) {
        failed++;
        const msg = `❌ Error parsing row ${r - range.s.r - 1}: ${err}`;
        errorLogs.push(msg);
        console.error(msg);
        continue;
      }
    }
  } finally {
    // This block always runs, even if there are errors
    console.log('---\nFINAL SUMMARY:');
    console.log(`Total rows processed: ${totalRows}`);
    console.log(`Successful store pushes: ${successful}`);
    console.log(`Unsuccessful store pushes: ${failed}`);
    if (errorLogs.length) {
      console.log('❌ Error details:');
      errorLogs.forEach(e => console.log(e));
    }
  }
}

main();

