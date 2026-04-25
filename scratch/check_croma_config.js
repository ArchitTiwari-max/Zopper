const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.storeChainConfig.findMany({
    where: {
      OR: [
        { prefix: 'CROMA' },
        { prefix: 'Croma' },
        { chainName: { contains: 'Croma', mode: 'insensitive' } }
      ]
    }
  });
  console.log(JSON.stringify(configs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
