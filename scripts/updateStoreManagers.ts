import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Please provide the path to the Excel file.');
    process.exit(1);
  }

  console.log(`Reading Excel file from ${filePath}...`);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Assuming headers are "Store Key", "Zonal Manager", "Cluster Manager"
  const data = xlsx.utils.sheet_to_json<any>(sheet);

  console.log(`Found ${data.length} rows. Starting update...`);

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const row of data) {
    const storeKey = row['Store Key'] || row['store key'] || row['Store key'];
    const zonalManager = row['Zonal Manager'] || row['zonal manager'];
    const clusterManager = row['Cluster Manager'] || row['cluster manager'];

    if (!storeKey) {
      console.log(`Skipping row without Store Key:`, row);
      continue;
    }

    try {
      const storeBrands = await prisma.storeBrand.findMany({
        where: { storeBrandId: storeKey.toString() },
      });

      if (storeBrands.length === 0) {
        console.log(`No stores found mapped to storeBrandId: ${storeKey}`);
        notFoundCount++;
        continue;
      }

      const storeIdsToUpdate = Array.from(new Set(storeBrands.map(sb => sb.storeId)));

      for (const sId of storeIdsToUpdate) {
        await prisma.store.update({
          where: { id: sId },
          data: {
            zonalManager: zonalManager ? zonalManager.toString() : null,
            clusterManager: clusterManager ? clusterManager.toString() : null,
          },
        });
        updatedCount++;
      }
    } catch (error: any) {
      console.error(`Error updating stores for storeBrandId ${storeKey}:`, error.message);
    }
  }

  console.log(`\nUpdate Complete!`);
  console.log(`Total stores updated: ${updatedCount}`);
  console.log(`Stores not found: ${notFoundCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
