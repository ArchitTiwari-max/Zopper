import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const storeNames = [
    "Reliance Digital- Rrl Cdit Pacific Mall Dwarka -TDI7",
    "Reliance Digital -Rrl Cdit Dwarka -9595",
    "Croma-Delhi-Dwarka Sector 12- A503"
  ];

  const stores = await prisma.store.findMany({
    where: { storeName: { in: storeNames } },
    include: {
      executiveStores: {
        include: {
          executive: true
        }
      }
    }
  });

  for (const s of stores) {
    console.log(`Store: ${s.storeName}`);
    console.log("Assigned Executives:");
    for (const es of s.executiveStores) {
      console.log(`  - ID: ${es.executiveId}, Name: ${es.executive.name}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
