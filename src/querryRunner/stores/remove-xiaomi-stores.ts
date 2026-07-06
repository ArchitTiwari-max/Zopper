import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Removing recently added Xiaomi stores...");
  
  // The max store_id before import was 8451. We delete stores added after this.
  const allStoreBrands = await prisma.storeBrand.findMany({
    where: { brandId: 'brand_006' } // Xiaomi brand
  });

  const storesToDelete = [];
  for (const sb of allStoreBrands) {
    if (sb.storeId.startsWith('store_')) {
      const numPart = parseInt(sb.storeId.replace('store_', ''), 10);
      if (!isNaN(numPart) && numPart > 8451) {
        storesToDelete.push(sb.storeId);
      }
    }
  }

  console.log(`Found ${storesToDelete.length} newly added Xiaomi stores to delete.`);

  if (storesToDelete.length > 0) {
    // We have to delete StoreBrand records first, then Store records
    const deletedStoreBrands = await prisma.storeBrand.deleteMany({
      where: {
        storeId: { in: storesToDelete }
      }
    });
    console.log(`Deleted ${deletedStoreBrands.count} StoreBrand relations.`);

    // Delete the Store records
    const deletedStores = await prisma.store.deleteMany({
      where: {
        id: { in: storesToDelete }
      }
    });
    console.log(`Deleted ${deletedStores.count} Store records.`);
  }
  
  console.log("Cleanup complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
