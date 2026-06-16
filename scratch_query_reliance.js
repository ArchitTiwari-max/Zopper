const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const relianceStores = await prisma.store.count({
    where: {
      storeName: {
        contains: 'reliance',
        mode: 'insensitive'
      }
    }
  });

  console.log(`Reliance Stores count: ${relianceStores}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
