import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

async function main() {
  const workbook = XLSX.readFile("src/querryRunner/stores/stores.xlsx");
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const stores: any[] = XLSX.utils.sheet_to_json(sheet);

  console.log("Detected headers:", Object.keys(stores[0])); // 🔍 debug

 for (const store of stores) {
  try {
    const rawBrands = store.partnerBrandIds || store["Partner Brands"] || "";
    const brandIds = rawBrands
      ? rawBrands.toString().split(",").map((id: string) => id.trim())
      : [];

    await prisma.store.create({
      data: {
        id: store.Store_ID,
        storeName: store.Store_Name || store["Store_Name"],
        city: store.city || store["City"] || null,
        fullAddress: store.fullAddress || store["Full Address"] || null,
        partnerBrandIds: brandIds,
      },
    });

    console.log(`✅ Inserted store: ${store.Store_Name || store["Store_Name"]}`);
  } catch (err) {
    console.error(
      `❌ Failed to insert store ${store.Store_Name || store["Store_Name"]}:`,
    );
    // continue loop
  }
}


  console.log("Stores imported successfully!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => prisma.$disconnect());
