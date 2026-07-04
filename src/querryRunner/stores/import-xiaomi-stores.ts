import { PrismaClient, PartnerBrandType } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Xiaomi store import...");

  // 1. Get or create Xiaomi brand
  const brandName = 'Xiaomi';
  let brand = await prisma.brand.findFirst({
    where: { brandName: { equals: brandName, mode: 'insensitive' } }
  });

  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        id: 'brand_xiaomi',
        brandName: brandName
      }
    });
    console.log(`Created new brand: ${brandName}`);
  } else {
    console.log(`Found brand: ${brand.brandName} with ID: ${brand.id}`);
  }

  // 2. Find max store_id number in DB
  const existingStores = await prisma.store.findMany({ select: { id: true } });
  let maxIdNum = 0;
  for (const store of existingStores) {
    if (store.id.startsWith('store_')) {
      const numPart = parseInt(store.id.replace('store_', ''), 10);
      if (!isNaN(numPart) && numPart > maxIdNum) {
        maxIdNum = numPart;
      }
    }
  }
  console.log(`Current max store_id number is: ${maxIdNum}`);

  // 3. Read Excel
  const workbook = XLSX.readFile('Xiaomi_Jul-26.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(worksheet);

  let currentIdNum = maxIdNum;
  let createdCount = 0;

  for (const row of rows) {
    const retailerName = (row['RetailerName'] || '').toString().trim();
    if (!retailerName) continue;

    currentIdNum++;
    const newStoreId = `store_${currentIdNum.toString().padStart(4, '0')}`;
    const targetRevenue = typeof row['Jul-26'] === 'number' ? row['Jul-26'] : null;
    const state = (row['State'] || '').toString().trim() || null;
    const distributorName = (row['DistributorName'] || '').toString().trim() || null;

    try {
      // Create Store (no assignment to any executive)
      await prisma.store.create({
        data: {
          id: newStoreId,
          storeName: retailerName,
          state: state,
          fullAddress: distributorName,   // Distributor name saved here for reference
          storeCategory: 'XIAOMI_TARGET', // Marks this as target-only, not for visits
        }
      });

      // Link Store to Xiaomi brand
      await prisma.storeBrand.create({
        data: {
          storeId: newStoreId,
          brandId: brand.id,
          brandType: PartnerBrandType.NONE
        }
      });

      // Save July 2026 target
      if (targetRevenue !== null) {
        await prisma.storeTarget.create({
          data: {
            storeId: newStoreId,
            brandId: brand.id,
            month: 7,
            year: 2026,
            targetRevenue: targetRevenue,
          }
        });
      }

      createdCount++;
      if (createdCount % 500 === 0) {
        console.log(`Imported ${createdCount} stores so far...`);
      }
    } catch (err) {
      console.error(`Error inserting store "${retailerName}" (${newStoreId}):`, err);
    }
  }

  console.log(`\nDone! Successfully imported ${createdCount} Xiaomi stores with July 2026 targets.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
