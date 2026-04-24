import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  
  const istTodayStart = new Date(istNow);
  istTodayStart.setHours(0, 0, 0, 0);
  
  const utcTodayStart = new Date(istTodayStart.getTime() - istOffset);
  const utcTomorrowStart = new Date(utcTodayStart);
  utcTomorrowStart.setDate(utcTomorrowStart.getDate() + 1);

  console.log('Searching for visits between:');
  console.log('Start:', utcTodayStart.toISOString());
  console.log('End:', utcTomorrowStart.toISOString());

  const visits = await prisma.visit.findMany({
    where: {
      visitDate: {
        gte: utcTodayStart,
        lt: utcTomorrowStart,
      },
    },
    include: {
        store: true
    }
  });

  console.log(`Found ${visits.length} visits.`);
  visits.forEach(v => {
    console.log(`- Store: ${v.store.storeName}, Date: ${v.visitDate?.toISOString()}, CreatedAt: ${v.createdAt.toISOString()}`);
  });

  // Also check if visits exist but with null visitDate
  const allVisitsToday = await prisma.visit.findMany({
      where: {
          createdAt: {
              gte: utcTodayStart,
              lt: utcTomorrowStart
          }
      },
      include: {
          store: true
      }
  })
  console.log(`Found ${allVisitsToday.length} visits created today (by createdAt).`);
  allVisitsToday.forEach(v => {
    console.log(`- Store: ${v.store.storeName}, visitDate: ${v.visitDate?.toISOString()}, createdAt: ${v.createdAt.toISOString()}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
