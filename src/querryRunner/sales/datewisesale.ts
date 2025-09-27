import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function postDailySales(rowObj: Record<string, any>, successCount: number): Promise<string> {
  try {
    const { Store_ID, Brand, Category, ...dateMetrics } = rowObj;
    const context = `Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
    if (!Store_ID || !Brand || !Category) {
      return `❌ Missing Store_ID, Brand, or Category. ${context}`;
    }
    const store = await prisma.store.findUnique({ where: { id: Store_ID } });
    if (!store) return `❌ Store not found. ${context}`;
    const brand = await prisma.brand.findUnique({ where: { brandName: Brand } });
    if (!brand) return `❌ Brand not found. ${context}`;
    const category = await prisma.category.findUnique({ where: { categoryName: Category } });
    if (!category) return `❌ Category not found. ${context}`;
    if (!store.partnerBrandIds.includes(brand.id)) {
      return `❌ Brand is not mapped to this store. ${context}`;
    }
    const catBrand = await prisma.categoryBrand.findUnique({
      where: { brandId_categoryId: { brandId: brand.id, categoryId: category.id } }
    });
    if (!catBrand) {
      return `❌ Category is not mapped to this brand. ${context}`;
    }

    // Build dailySales array
    const dailySales: any[] = [];
    for (const key in dateMetrics) {
      const match = key.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4}) (Count of Sales|Revenue)$/);
      if (!match) continue;
      const [_, dd, mm, yyyy, metric] = match;
      const date = `${yyyy}-${mm}-${dd}`; // ISO format
      let entry = dailySales.find(e => e.date === date);
      if (!entry) {
        entry = { date };
        dailySales.push(entry);
      }
      if (/count of sales/i.test(metric)) entry.countOfSales = dateMetrics[key] || 0;
      if (/revenue/i.test(metric)) entry.revenue = dateMetrics[key] || 0;
    }

    // Upsert SalesRecord for the year
    const year = dailySales.length > 0 ? parseInt(dailySales[0].date.slice(0, 4)) : new Date().getFullYear();
    await prisma.salesRecord.upsert({
      where: {
        storeId_brandId_categoryId_year: {
          storeId: Store_ID,
          brandId: brand.id,
          categoryId: category.id,
          year,
        },
      },
      update: { dailySales },
      create: {
        storeId: Store_ID,
        brandId: brand.id,
        categoryId: category.id,
        year,
        monthlySales: [],
        dailySales,
      },
    });
    return `✅ Daily sales stored for ${context}. Total successful: ${successCount}`;
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
  const workbook = XLSX.readFile('src/querryRunner/sales/datewisesale.xlsx');
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
        const message = await postDailySales(rowObj, successful + 1);
        if (message.startsWith('✅ Daily sales stored')) {
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
    console.log('---\nFINAL SUMMARY:');
    console.log(`Total rows processed: ${totalRows}`);
    console.log(`Successful daily sales pushes: ${successful}`);
    console.log(`Unsuccessful pushes: ${failed}`);
    if (errorLogs.length) {
      console.log('❌ Error details:');
      errorLogs.forEach(e => console.log(e));
    }
  }
}

main();
