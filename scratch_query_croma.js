const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cromaStores = await prisma.store.count({
    where: {
      storeName: {
        contains: 'croma',
        mode: 'insensitive' // case-insensitive search
      }
    }
  });

  const vsStores = await prisma.store.count({
    where: {
      storeName: {
        contains: 'vs-',
        mode: 'insensitive'
      }
    }
  });

  console.log(`Croma Stores count: ${cromaStores}`);
  console.log(`Vijay Sales (VS) Stores count: ${vsStores}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
