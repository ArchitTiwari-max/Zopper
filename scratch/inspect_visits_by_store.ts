import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const storeNames = [
    "Reliance Digital- Rrl Cdit Pacific Mall Dwarka -TDI7",
    "Reliance Digital -Rrl Cdit Dwarka -9595",
    "Croma-Delhi-Dwarka Sector 12- A503"
  ];

  const visits = await prisma.visit.findMany({
    where: {
      store: {
        storeName: { in: storeNames }
      }
    },
    select: {
      id: true,
      executiveId: true,
      executive: { select: { id: true, name: true } },
      store: { select: { storeName: true } }
    }
  });

  console.log(`Found ${visits.length} visits:`);
  for (const v of visits) {
    console.log(`Visit ID: ${v.id}, ExecID: ${v.executiveId}, ExecName: ${v.executive?.name}, Store: ${v.store?.storeName}`);
  }
}

main().finally(() => prisma.$disconnect());
