import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function deleteStoreData(storeId: string) {
  try {
    console.log(`\n--- Processing Store ID: ${storeId} ---`);
    
    // Check if store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      console.log(`⚠️ Store ${storeId} not found. Skipping.`);
      return;
    }

    // 1. Find all related visits
    const visits = await prisma.visit.findMany({ where: { storeId } });
    const visitIds = visits.map((v: any) => v.id);

    const digitalVisits = await prisma.digitalVisit.findMany({ where: { storeId } });
    const digitalVisitIds = digitalVisits.map((v: any) => v.id);

    // 2. Find related issues
    const issueIds: string[] = [];
    if (visitIds.length > 0 || digitalVisitIds.length > 0) {
      const issues = await prisma.issue.findMany({
        where: {
          OR: [
            ...(visitIds.length > 0 ? [{ visitId: { in: visitIds } }] : []),
            ...(digitalVisitIds.length > 0 ? [{ digitalVisitId: { in: digitalVisitIds } }] : [])
          ]
        }
      });
      issues.forEach((i: any) => issueIds.push(i.id));
    }

    // 3. Find related assignments to issues
    const assignedIds: string[] = [];
    if (issueIds.length > 0) {
      const assigneds = await prisma.assigned.findMany({ where: { issueId: { in: issueIds } } });
      assigneds.forEach((a: any) => assignedIds.push(a.id));
    }

    // 4. Delete Notifications (related to visits, issues, assignments)
    const notificationOrConditions: any[] = [];
    if (assignedIds.length > 0) notificationOrConditions.push({ assignedId: { in: assignedIds } });
    if (issueIds.length > 0) notificationOrConditions.push({ issueId: { in: issueIds } });
    if (visitIds.length > 0) notificationOrConditions.push({ visitId: { in: visitIds } });
    
    if (notificationOrConditions.length > 0) {
      const delNotifs = await prisma.notification.deleteMany({
        where: { OR: notificationOrConditions }
      });
      if (delNotifs.count > 0) console.log(`Deleted ${delNotifs.count} notifications`);
    }

    // 5. Delete AssignReports
    if (assignedIds.length > 0) {
      const delAssignReports = await prisma.assignReport.deleteMany({
        where: { assignedId: { in: assignedIds } }
      });
      if (delAssignReports.count > 0) console.log(`Deleted ${delAssignReports.count} assign reports`);
    }

    // 6. Delete Assignments
    if (issueIds.length > 0) {
      const delAssigned = await prisma.assigned.deleteMany({
        where: { issueId: { in: issueIds } }
      });
      if (delAssigned.count > 0) console.log(`Deleted ${delAssigned.count} assignments`);
    }

    // 7. Delete Issues
    if (issueIds.length > 0) {
      const delIssues = await prisma.issue.deleteMany({
        where: { id: { in: issueIds } }
      });
      if (delIssues.count > 0) console.log(`Deleted ${delIssues.count} issues`);
    }

    // 8. Delete Visits
    if (visitIds.length > 0) {
      const delVisits = await prisma.visit.deleteMany({ where: { storeId } });
      console.log(`Deleted ${delVisits.count} physical visits`);
    }

    if (digitalVisitIds.length > 0) {
      const delDigitalVisits = await prisma.digitalVisit.deleteMany({ where: { storeId } });
      console.log(`Deleted ${delDigitalVisits.count} digital visits`);
    }

    // 9. Delete Admin Visits
    const delAdminVisits = await prisma.adminVisit.deleteMany({ where: { storeId } });
    if (delAdminVisits.count > 0) console.log(`Deleted ${delAdminVisits.count} admin visits`);

    // 10. Delete Sales Records
    const delSales = await prisma.salesRecord.deleteMany({ where: { storeId } });
    if (delSales.count > 0) console.log(`Deleted ${delSales.count} sales records`);

    // 11. Delete Executive Store Assignments
    const delExecStores = await prisma.executiveStoreAssignment.deleteMany({ where: { storeId } });
    if (delExecStores.count > 0) console.log(`Deleted ${delExecStores.count} executive store assignments`);

    // 12. Delete Store Alignment
    const delAlignment = await prisma.storeAlignment.deleteMany({ where: { storeId } });
    if (delAlignment.count > 0) console.log(`Deleted ${delAlignment.count} store alignments`);

    // 13. Finally, delete the store itself
    await prisma.store.delete({ where: { id: storeId } });
    console.log(`✅ Successfully deleted store: ${storeId}`);

  } catch (error) {
    console.error(`❌ Error deleting store ${storeId}:`, error);
  }
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: npx tsx scripts/delete_stores.ts <path-to-excel-file>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading Excel file: ${filePath}`);
  
  try {
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Parse sheet to JSON array
    const data: any[] = xlsx.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
      console.log('Excel file is empty.');
      return;
    }

    // Identify the column containing the store ID
    // Look for common headers like 'id', 'storeId', 'store id', 'Store ID'
    const firstRow = data[0];
    const possibleKeys = Object.keys(firstRow);
    let storeIdKey = possibleKeys.find(key => 
      key.toLowerCase() === 'id' || 
      key.toLowerCase() === 'storeid' || 
      key.toLowerCase() === 'store_id' || 
      key.toLowerCase() === 'store id'
    );

    // If we can't find a standard key, default to the first column
    if (!storeIdKey) {
      storeIdKey = possibleKeys[0];
      console.log(`Warning: Could not find 'id' or 'storeId' column. Using first column '${storeIdKey}' as Store ID.`);
    }

    console.log(`Found ${data.length} rows. Using column '${storeIdKey}' for Store IDs.`);

    const storeIds = data
      .map(row => row[storeIdKey])
      .filter(id => id && String(id).trim() !== '')
      .map(id => String(id).trim());

    const uniqueStoreIds = [...new Set(storeIds)];
    console.log(`Total unique Store IDs to delete: ${uniqueStoreIds.length}`);

    for (const storeId of uniqueStoreIds) {
      await deleteStoreData(storeId);
    }

    console.log('\n🎉 Finished processing all stores.');

  } catch (error) {
    console.error('Error processing excel file:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
