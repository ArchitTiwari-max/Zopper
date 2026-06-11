import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface ExcelRow {
  Store_ID?: string;
  'Store Name'?: string;
  City?: string;
  partneraBrandIds?: string;
  partnerBrandTypes?: string;
  Executive_IDs?: string;
  "POC's Name"?: string;
  'Number of Visits'?: number;
  DB?: string;
}

async function main() {
  const filePath = path.join(process.cwd(), 'newdelete.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found at ${filePath}`);
    return;
  }

  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Parse rows as objects
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);
  console.log(`Successfully read ${rows.length} rows from Excel.`);

  const missingInDb: any[] = [];
  const zeroPhysicalVisitStores: any[] = [];
  const zeroTotalVisitStores: any[] = [];
  const activeVisitStores: any[] = [];

  let processed = 0;
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    
    await Promise.all(chunk.map(async (row) => {
      const storeId = row.Store_ID?.trim();
      if (!storeId) return;

      try {
        const dbStore = await prisma.store.findUnique({
          where: { id: storeId },
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

        if (!dbStore) {
          missingInDb.push({
            'Excel Store ID': storeId,
            'Excel Store Name': row['Store Name'] || '',
            'Excel City': row.City || '',
            'Excel Visits Column': row['Number of Visits'] ?? 0,
            'Status': 'Missing in DB'
          });
        } else {
          const physicalVisits = dbStore._count.visits;
          const digitalVisits = dbStore._count.digitalVisits;
          const adminVisits = dbStore._count.adminVisits;
          const totalVisits = physicalVisits + digitalVisits + adminVisits;

          const storeData = {
            'Store ID': storeId,
            'Store Name (Excel)': row['Store Name'] || '',
            'Store Name (DB)': dbStore.storeName,
            'City (DB)': dbStore.city,
            'Physical Visits (DB)': physicalVisits,
            'Digital Visits (DB)': digitalVisits,
            'Admin Visits (DB)': adminVisits,
            'Total Visits (DB)': totalVisits,
            'Excel Visits Column': row['Number of Visits'] ?? 0
          };

          if (physicalVisits === 0) {
            zeroPhysicalVisitStores.push(storeData);
          }
          if (totalVisits === 0) {
            zeroTotalVisitStores.push(storeData);
          }
          if (totalVisits > 0) {
            activeVisitStores.push(storeData);
          }
        }
      } catch (err) {
        console.error(`Error processing store ${storeId}:`, err);
      }
    }));

    processed += chunk.length;
    if (processed % 1000 === 0 || processed >= rows.length) {
      console.log(`Processed ${processed}/${rows.length} rows...`);
    }
  }

  console.log('\n--- Analysis Summary ---');
  console.log(`Total rows in Excel: ${rows.length}`);
  console.log(`1. Stores missing in Database: ${missingInDb.length}`);
  console.log(`2. Stores with 0 physical visits in DB: ${zeroPhysicalVisitStores.length}`);
  console.log(`3. Stores with 0 total visits (physical + digital + admin) in DB: ${zeroTotalVisitStores.length}`);
  console.log(`4. Stores with >0 visits in DB: ${activeVisitStores.length}`);

  // Create a new Excel workbook to save all lists in separate sheets
  const newWorkbook = XLSX.utils.book_new();

  // Sheet 1: Summary info
  const summaryData = [
    { Metric: 'Total Rows in Excel', Count: rows.length },
    { Metric: 'Stores Missing in Database', Count: missingInDb.length },
    { Metric: 'Stores with 0 Physical Visits in DB', Count: zeroPhysicalVisitStores.length },
    { Metric: 'Stores with 0 Total Visits in DB (Physical + Digital + Admin)', Count: zeroTotalVisitStores.length },
    { Metric: 'Stores with active visits (>0 visits) in DB', Count: activeVisitStores.length }
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(newWorkbook, summarySheet, 'Summary');

  // Sheet 2: 0 Total Visits
  if (zeroTotalVisitStores.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(zeroTotalVisitStores);
    XLSX.utils.book_append_sheet(newWorkbook, sheet, 'Zero Total Visits');
  }

  // Sheet 3: 0 Physical Visits
  if (zeroPhysicalVisitStores.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(zeroPhysicalVisitStores);
    XLSX.utils.book_append_sheet(newWorkbook, sheet, 'Zero Physical Visits');
  }

  // Sheet 4: Missing in DB
  if (missingInDb.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(missingInDb);
    XLSX.utils.book_append_sheet(newWorkbook, sheet, 'Missing in DB');
  }

  // Write file
  const reportPath = path.join(process.cwd(), 'zero_visit_stores_report.xlsx');
  XLSX.writeFile(newWorkbook, reportPath);
  console.log(`\nGenerated report: ${reportPath}`);

  // Print first 5 stores of zero visits to show as sample
  if (zeroTotalVisitStores.length > 0) {
    console.log('\nSample Zero-Visit Stores (First 5):');
    console.log(zeroTotalVisitStores.slice(0, 5));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
