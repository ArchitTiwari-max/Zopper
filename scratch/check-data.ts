import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.storeAlignment.count();
    console.log(`Total Alignment Records: ${count}`);

    const alignments = await prisma.storeAlignment.findMany({
      take: 5,
      include: {
        store: {
          select: {
            storeName: true,
            city: true
          }
        }
      }
    });

    console.log('\n--- Sample Records ---');
    alignments.forEach((a, i) => {
      console.log(`${i+1}. Store: ${a.store?.storeName} (${a.store?.city})`);
      console.log(`   Store Level Roles: ${(a.storeLevel as any[]).length}`);
      console.log(`   Stakeholder Roles: ${(a.stakeholderLevel as any[]).length}`);
      console.log('-------------------------');
    });

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
