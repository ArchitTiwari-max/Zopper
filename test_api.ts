import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const [year, month, day] = [2026, 5, 15];
  const startOfTargetDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endOfTargetDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  const rescheduledVisits = await prisma.visit.findMany({
      where: {
          executiveId: 'executive_00002',
          nextScheduledDate: {
              gte: startOfTargetDay,
              lte: endOfTargetDay
          }
      },
      include: {
          store: true
      }
  });
  console.log("Found:", rescheduledVisits.length);
  rescheduledVisits.forEach(v => console.log(v.store.storeName, v.nextScheduledDate));
}
main().catch(console.error).finally(() => prisma.$disconnect());
