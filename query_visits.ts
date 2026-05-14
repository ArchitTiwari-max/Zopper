import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const visits = await prisma.visit.findMany({
    where: {
      nextScheduledDate: { not: null }
    },
    include: { store: true }
  });
  console.log(JSON.stringify(visits.map(v => ({
    storeName: v.store.storeName,
    nextScheduledDate: v.nextScheduledDate
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
