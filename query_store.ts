import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const store = await prisma.store.findFirst({
    where: {
      storeName: { contains: "Sanjay Place" }
    }
  });
  if (store) {
      const visits = await prisma.visit.findMany({
          where: { storeId: store.id, nextScheduledDate: { not: null } }
      });
      console.log("Visits for Sanjay Place:", JSON.stringify(visits, null, 2));
  } else {
      console.log("Not found");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
