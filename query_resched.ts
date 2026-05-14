import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const [year, month, day] = [2026, 5, 15];
  const startOfTargetDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endOfTargetDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  
  const visits = await prisma.visit.findMany({
    where: {
      nextScheduledDate: {
        gte: startOfTargetDay,
        lte: endOfTargetDay
      }
    },
    include: { store: true, executive: true }
  });
  console.log(JSON.stringify(visits.map(v => ({
    storeName: v.store.storeName,
    executiveName: v.executive.name,
    executiveId: v.executiveId,
    nextScheduledDate: v.nextScheduledDate
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
