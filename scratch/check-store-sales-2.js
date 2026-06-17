const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const storeId = "store_000247";
  
  // Find store details
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { storeBrands: { include: { brand: true } } }
  });
  
  console.log("Store details:");
  console.log(`  ID: ${store?.id}`);
  console.log(`  Name: ${store?.storeName}`);
  console.log("  Mapped Brands:");
  store?.storeBrands.forEach(sb => {
    console.log(`    - Brand ID: ${sb.brandId}, Brand Name: ${sb.brand.brandName}, storeBrandId: ${sb.storeBrandId}`);
  });

  // Find sales records
  const salesRecords = await prisma.salesRecord.findMany({
    where: { storeId: storeId },
    include: { brand: true, category: true }
  });

  console.log(`\nFound ${salesRecords.length} SalesRecord(s) in DB for ${storeId}:`);
  salesRecords.forEach(sr => {
    console.log(`\n--- Record ID: ${sr.id} ---`);
    console.log(`  Year: ${sr.year}`);
    console.log(`  Brand: ${sr.brand.brandName} (${sr.brandId})`);
    console.log(`  Category: ${sr.category.categoryName} (${sr.categoryId})`);
    console.log(`  Monthly Sales Count: ${sr.monthlySales?.length || 0}`);
    console.log(`  Monthly Sales Data:`, JSON.stringify(sr.monthlySales));
    console.log(`  Daily Sales Months/Keys:`, Object.keys(sr.dailySales || {}));
    if (sr.dailySales) {
      for (const m of Object.keys(sr.dailySales)) {
        console.log(`    Month ${m} daily records count: ${sr.dailySales[m]?.length || 0}`);
        if (sr.dailySales[m]?.length > 0) {
          console.log(`    Sample:`, sr.dailySales[m].slice(0, 2));
        }
      }
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);
