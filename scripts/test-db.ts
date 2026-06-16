import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Connecting to database...');
    const count = await prisma.store.count();
    console.log(`Database connection successful! Total stores: ${count}`);
    
    // Sample a few stores
    const samples = await prisma.store.findMany({
      take: 5,
      select: {
        id: true,
        storeName: true,
        city: true
      }
    });
    console.log('Sample stores from DB:', JSON.stringify(samples, null, 2));
  } catch (err) {
    console.error('Error connecting to database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
