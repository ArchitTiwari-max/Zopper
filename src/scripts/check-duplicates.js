const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const executives = await prisma.executive.findMany({
    select: {
      id: true,
      userId: true,
      name: true
    }
  });

  const idMap = new Map();
  const userIdMap = new Map();

  executives.forEach(ex => {
    if (idMap.has(ex.id)) {
      console.log(`DUPLICATE Executive ID: ${ex.id} for users ${idMap.get(ex.id)} and ${ex.userId}`);
    } else {
      idMap.set(ex.id, ex.userId);
    }

    if (userIdMap.has(ex.userId)) {
      console.log(`DUPLICATE User ID: ${ex.userId} for executives ${userIdMap.get(ex.userId)} and ${ex.id}`);
    } else {
      userIdMap.set(ex.userId, ex.id);
    }
  });

  console.log(`Checked ${executives.length} executives. No duplicates found if no messages above.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
