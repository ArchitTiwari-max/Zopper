import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sonalId = 'executive_00026';
  const sonal = await prisma.executive.findUnique({
    where: { id: sonalId },
    select: { id: true, name: true, subordinateIds: true }
  });

  if (!sonal) return;

  const now = new Date("2026-06-18T20:10:05"); // Current local time in metadata is 2026-06-18
  const from = new Date(now);
  from.setDate(now.getDate() - 30);
  from.setHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const visits = await prisma.visit.findMany({
    where: {
      executiveId: { in: sonal.subordinateIds },
      visitDate: { gte: from, lte: to }
    },
    select: {
      id: true,
      executiveId: true,
      executive: { select: { name: true } },
      visitDate: true,
      store: { select: { storeName: true } }
    }
  });

  console.log(`Visits in last 30 days count: ${visits.length}`);
  for (const v of visits) {
    console.log(`Date: ${v.visitDate?.toISOString()}, Exec: ${v.executive?.name}, Store: ${v.store?.storeName}`);
  }
}

main().finally(() => prisma.$disconnect());
