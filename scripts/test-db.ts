import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const totalStores = await prisma.store.count();
    
    // Count stores that have at least one StoreBrand relation
    const storesWithBrands = await prisma.store.count({
      where: {
        storeBrands: {
          some: {},
        },
      },
    });
    
    const totalStoreBrands = await prisma.storeBrand.count();
    
    // Count StoreBrand records that have a brandType other than NONE
    const migratedStoreBrands = await prisma.storeBrand.count({
      where: {
        brandType: {
          not: 'NONE',
        },
      },
    });

    console.log('--- DB Check ---');
    console.log(`Total Stores: ${totalStores}`);
    console.log(`Stores with StoreBrand relations: ${storesWithBrands}`);
    console.log(`Total StoreBrand records: ${totalStoreBrands}`);
    console.log(`StoreBrand records with brandType (not NONE): ${migratedStoreBrands}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
