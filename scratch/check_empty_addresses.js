const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.store.count({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      OR: [
        { fullAddress: null },
        { fullAddress: '' }
      ]
    }
  });

  console.log(`Stores with coordinates but missing/blank fullAddress: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
