import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sonalId = 'executive_00026';
  const sonal = await prisma.executive.findUnique({
    where: { id: sonalId },
    select: { id: true, name: true, subordinateIds: true }
  });

  if (!sonal) {
    console.error("Sonal Kumar not found");
    return;
  }

  console.log("Sonal Kumar subordinates:", sonal.subordinateIds);

  const visits = await prisma.visit.findMany({
    where: {
      executiveId: { in: sonal.subordinateIds }
    },
    select: {
      id: true,
      executiveId: true,
      executive: { select: { id: true, name: true } },
      store: { select: { storeName: true } }
    }
  });

  console.log(`Found ${visits.length} physical visits for Sonal's subordinates:`);
  for (const v of visits) {
    console.log(`Visit ID: ${v.id}, ExecID: ${v.executiveId}, ExecName: ${v.executive?.name}, Store: ${v.store?.storeName}`);
  }
}

main().finally(() => prisma.$disconnect());
