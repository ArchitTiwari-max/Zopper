const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({
    where: {
      storeName: {
        contains: 'reliance',
        mode: 'insensitive'
      },
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    },
    select: {
      id: true,
      storeName: true,
      city: true,
      fullAddress: true,
      latitude: true,
      longitude: true
    }
  });

  console.log(`\n=== RELIANCE STORES MISSING LAT/LONG ===`);
  console.log(`Total count: ${stores.length}`);
  console.log(`----------------------------------------`);
  
  if (stores.length > 0) {
    console.log("List of stores:");
    stores.forEach((store, index) => {
      console.log(`${index + 1}. [${store.id}] ${store.storeName} (${store.city || 'No City'}) - Address: ${store.fullAddress || 'No Address'}`);
    });
  } else {
    console.log("No Reliance stores are missing lat/long!");
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
