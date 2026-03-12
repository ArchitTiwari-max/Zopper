import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        storeName: true,
        city: true,
        partnerBrandTypes: true,
        partnerBrandIds: true,
        salesRecords: {
          where: { year: { in: [2024, 2025] } },
          select: { year: true, monthlySales: true, dailySales: true, }
        }
      }
    });

    for (const store of stores) {
      if (!store.partnerBrandTypes) throw new Error("partnerBrandTypes missing");
      for (const salesRecord of store.salesRecords) {
        if (!Array.isArray(salesRecord.monthlySales)) {
          console.log(`Store ${store.id}: monthlySales is not an array:`, salesRecord.monthlySales);
        } else {
          try {
            salesRecord.monthlySales.find((m: any) => m.month === 9);
          } catch(e) {
            console.log(`Store ${store.id}: Error running find:`, e);
          }
        }
      }
    }
    console.log("Checked all stores.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
