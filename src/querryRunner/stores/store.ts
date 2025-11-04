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



import { PrismaClient, PartnerBrandType } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  const workbook = XLSX.readFile('src/querryRunner/stores/exportstore.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows: { Store_ID: string; 'Store Name': string; City: string; partneraBrandIds?: string; partnerBrandIds?: string; partnerBrandTypes?: string; 'PartnerBrandTypes'?: string; 'Partner Brand Types'?: string; Executive_IDs?: string }[] = XLSX.utils.sheet_to_json(worksheet);

  for (const row of rows) {
    const storeId = row.Store_ID?.trim() || '';
    const storeName = row['Store Name']?.trim() || '';
    const city = row.City?.trim() || '';
    const partnerBrandIdsString = (row.partnerBrandIds || row.partneraBrandIds || '').toString();
    const partnerBrandTypesString = (row.partnerBrandTypes || row['PartnerBrandTypes'] || row['Partner Brand Types'] || '').toString();
    const executiveIdsString = (row.Executive_IDs || '').toString();

    // Split brand IDs and executive IDs into arrays
    const partnerBrandIds = partnerBrandIdsString.split(',').map(id => id.trim()).filter(Boolean);
    const executiveIds = executiveIdsString.split(',').map(id => id.trim()).filter(Boolean);

    // Parse and validate partnerBrandTypes (aligned with partnerBrandIds)
    const rawTypes = partnerBrandTypesString.split(',').map(t => t.trim()).filter(Boolean);
    let partnerBrandTypes: PartnerBrandType[] = [];
    if (rawTypes.length > 0) {
      if (rawTypes.length !== partnerBrandIds.length) {
        console.error(`❌ partnerBrandTypes count (${rawTypes.length}) does not match partnerBrandIds count (${partnerBrandIds.length}) for store ${storeId}. Skipping this row.`);
        continue;
      }
      const mapType = (val: string): PartnerBrandType | null => {
        const v = val.toUpperCase().replace(/\s+/g, '');
        if (v === 'A+' || v === 'A_PLUS') return PartnerBrandType.A_PLUS;
        if (v === 'A') return PartnerBrandType.A;
        if (v === 'B') return PartnerBrandType.B;
        if (v === 'C') return PartnerBrandType.C;
        if (v === 'D') return PartnerBrandType.D;
        return null;
      };
      const mapped = rawTypes.map(mapType);
      if (mapped.some(m => m === null)) {
        console.error(`❌ Invalid partnerBrandTypes value(s) for store ${storeId}. Allowed: A+, A, B, C, D. Skipping this row.`);
        continue;
      }
      partnerBrandTypes = mapped as PartnerBrandType[];
    }
   
    try {
      await prisma.store.create({
        data: {
          id: storeId,
          storeName,
          city,
          fullAddress: '',
          partnerBrandIds,
          partnerBrandTypes,
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

