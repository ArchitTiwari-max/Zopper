const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const relianceStores = await prisma.store.findMany({
    where: {
      storeName: {
        contains: 'reliance',
        mode: 'insensitive'
      }
    },
    take: 5
  });

  console.log("Sample Reliance Store Details:");
  console.log(JSON.stringify(relianceStores, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
