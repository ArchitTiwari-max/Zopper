import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(process.cwd(), 'newdelete.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet);
  const excelStoreIds = new Set(rows.map(r => r.Store_ID?.trim()).filter(Boolean));

  // Find all store IDs that have physical, digital, or admin visits in the DB
  const physicalVisitStoreIds = await prisma.visit.findMany({
    select: { storeId: true },
    distinct: ['storeId']
  });
  
  const digitalVisitStoreIds = await prisma.digitalVisit.findMany({
    select: { storeId: true },
    distinct: ['storeId']
  });

  const adminVisitStoreIds = await prisma.adminVisit.findMany({
    select: { storeId: true },
    distinct: ['storeId']
  });

  const activeStoreIdsInDb = new Set([
    ...physicalVisitStoreIds.map(v => v.storeId),
    ...digitalVisitStoreIds.map(v => v.storeId),
    ...adminVisitStoreIds.map(v => v.storeId)
  ]);

  // Find intersection
  const activeExcelStoreIds = Array.from(excelStoreIds).filter(id => activeStoreIdsInDb.has(id));

  console.log(`Found ${activeExcelStoreIds.length} stores in Excel that have visits in DB.`);

  if (activeExcelStoreIds.length > 0) {
    const activeStoresInfo = await prisma.store.findMany({
      where: {
        id: { in: activeExcelStoreIds }
      },
      include: {
        _count: {
          select: {
            visits: true,
            digitalVisits: true,
            adminVisits: true
          }
        }
      }
    });

    const report = activeStoresInfo.map(s => ({
      'Store ID': s.id,
      'Store Name': s.storeName,
      'City': s.city,
      'Physical Visits': s._count.visits,
      'Digital Visits': s._count.digitalVisits,
      'Admin Visits': s._count.adminVisits,
      'Total Visits': s._count.visits + s._count.digitalVisits + s._count.adminVisits
    }));

    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
