// import { PrismaClient } from "@prisma/client";
// import * as XLSX from "xlsx";

// const prisma = new PrismaClient();

// async function main() {
//   const workbook = XLSX.readFile("src/querryRunner/stores/stores.xlsx");
//   const sheetName = workbook.SheetNames[0];
//   const sheet = workbook.Sheets[sheetName];
//   const stores: any[] = XLSX.utils.sheet_to_json(sheet);

//   console.log("Detected headers:", Object.keys(stores[0])); // 🔍 debug

//  for (const store of stores) {
//   try {
//     const rawBrands = store.partnerBrandIds || store["Partner Brands"] || "";
//     const brandIds = rawBrands
//       ? rawBrands.toString().split(",").map((id: string) => id.trim())
//       : [];

//     await prisma.store.create({
//       data: {
//         id: store.Store_ID,
//         storeName: store.Store_Name || store["Store_Name"],
//         city: store.city || store["City"] || null,
//         fullAddress: store.fullAddress || store["Full Address"] || null,
//         partnerBrandIds: brandIds,
//       },
//     });

//     console.log(`✅ Inserted store: ${store.Store_Name || store["Store_Name"]}`);
//   } catch (err) {
//     console.error(
//       `❌ Failed to insert store ${store.Store_Name || store["Store_Name"]}:`,
//     );
//     // continue loop
//   }
// }


//   console.log("Stores imported successfully!");
// }

// main()
//   .catch((e) => console.error(e))
//   .finally(async () => prisma.$disconnect());



import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  const workbook = XLSX.readFile('src/querryRunner/stores/exportstore.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows: { Store_ID: string; 'Store Name': string; City: string; partneraBrandIds: string; Executive_IDs: string }[] = XLSX.utils.sheet_to_json(worksheet);

  for (const row of rows) {
    const storeId = row.Store_ID?.trim() || '';
    const storeName = row['Store Name']?.trim() || '';
    const city = row.City?.trim() || '';
    const partnerBrandIdsString = row.partneraBrandIds || '';
    const executiveIdsString = row.Executive_IDs || '';
    // Split brand IDs and executive IDs into arrays
    const partnerBrandIds = partnerBrandIdsString.split(',').map(id => id.trim()).filter(Boolean);
    const executiveIds = executiveIdsString.split(',').map(id => id.trim()).filter(Boolean);
   
    try {
      await prisma.store.create({
        data: {
          id: storeId,
          storeName,
          city,
          fullAddress: '',
          partnerBrandIds,
        }
      });
      console.log(`✅ Created store: ${storeName} (ID: ${storeId})`);
    } catch (error) {
      console.error(`❌ Error creating store ${storeName} (ID: ${storeId}):`, error);
    }

    for (const executiveId of executiveIds) {
      try {
        await prisma.executiveStoreAssignment.create({
          data: {
            executiveId,
            storeId,
            assignedAt: new Date(),
          }
        });
        console.log(`✅ Assigned executive ${executiveId} to store ${storeId}`);
      } catch (error) {
        console.error(`❌ Error assigning executive ${executiveId} to store ${storeId}:`, error);
      }
    }
  }
  console.log("Stores imported successfully!");
}

main()
.catch(e => {
  console.error('Unexpected error:', e);
})
.finally(async () => {
  await prisma.$disconnect();
});

