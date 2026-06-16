import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const storeCount = await prisma.store.count();
  const executiveCount = await prisma.executive.count();
  const assignmentCount = await prisma.executiveStoreAssignment.count();
  
  console.log(`Total Stores: ${storeCount}`);
  console.log(`Total Executives: ${executiveCount}`);
  console.log(`Total Assignments: ${assignmentCount}`);

  const executives = await prisma.executive.findMany({
    take: 5,
    include: {
      _count: {
        select: { executiveStores: true }
      }
    }
  });

  console.log('\nSample Executives and their store counts:');
  executives.forEach(ex => {
    console.log(`ID: ${ex.id}, Name: ${ex.name}, Store Count: ${ex._count.executiveStores}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
