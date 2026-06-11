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

  console.log(`Loaded ${excelStoreIds.size} unique store IDs from Excel.`);

  // 1. Fetch distinct visited stores from DB
  console.log('Querying database for visited stores...');
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

  console.log(`Found ${activeStoreIdsInDb.size} stores in DB that have visits.`);

  // 2. Filter the Excel stores to find those with 0 visits (not in the active list)
  const storeIdsToDelete: string[] = [];
  for (const storeId of excelStoreIds) {
    if (!activeStoreIdsInDb.has(storeId)) {
      storeIdsToDelete.push(storeId);
    }
  }

  console.log(`Identified ${storeIdsToDelete.length} stores to delete (0 visits in DB).`);

  if (storeIdsToDelete.length === 0) {
    console.log('No stores found with 0 visits. Nothing to delete.');
    return;
  }

  // 3. Confirm counts of related data to be deleted
  console.log('Calculating related records that will be deleted...');
  const assignmentCount = await prisma.executiveStoreAssignment.count({
    where: { storeId: { in: storeIdsToDelete } }
  });
  const salesCount = await prisma.salesRecord.count({
    where: { storeId: { in: storeIdsToDelete } }
  });
  const alignmentCount = await prisma.storeAlignment.count({
    where: { storeId: { in: storeIdsToDelete } }
  });

  console.log(`\n--- Deletion Plan ---`);
  console.log(`- Stores to delete: ${storeIdsToDelete.length}`);
  console.log(`- Related Executive Store Assignments: ${assignmentCount}`);
  console.log(`- Related Sales Records: ${salesCount}`);
  console.log(`- Related Store Alignments: ${alignmentCount}`);
  console.log(`---------------------\n`);

  console.log('Starting deletion process...');

  // 4. Perform deletions in sequence to prevent foreign key issues
  // We use a transaction or execute sequentially
  const startTime = Date.now();

  console.log('Deleting Executive Store Assignments...');
  const deletedAssignments = await prisma.executiveStoreAssignment.deleteMany({
    where: { storeId: { in: storeIdsToDelete } }
  });
  console.log(`Deleted ${deletedAssignments.count} Executive Store Assignments.`);

  console.log('Deleting Sales Records...');
  const deletedSales = await prisma.salesRecord.deleteMany({
    where: { storeId: { in: storeIdsToDelete } }
  });
  console.log(`Deleted ${deletedSales.count} Sales Records.`);

  console.log('Deleting Store Alignments...');
  const deletedAlignments = await prisma.storeAlignment.deleteMany({
    where: { storeId: { in: storeIdsToDelete } }
  });
  console.log(`Deleted ${deletedAlignments.count} Store Alignments.`);

  console.log('Deleting Stores...');
  const deletedStores = await prisma.store.deleteMany({
    where: { id: { in: storeIdsToDelete } }
  });
  console.log(`Deleted ${deletedStores.count} Stores.`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nSuccessfully finished deletion process in ${duration} seconds.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
