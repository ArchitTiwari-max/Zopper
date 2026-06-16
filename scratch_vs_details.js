const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vsStore = await prisma.store.findFirst({
    where: {
      storeName: {
        contains: 'vs-',
        mode: 'insensitive'
      }
    }
  });

  console.log("Sample VS Store Details:");
  console.log(JSON.stringify(vsStore, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
