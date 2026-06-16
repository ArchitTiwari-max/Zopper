const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.store.count();
  console.log(`Total stores in database: ${total}`);

  const reliance = await prisma.store.count({
    where: { storeName: { contains: 'reliance', mode: 'insensitive' } }
  });
  const croma = await prisma.store.count({
    where: { storeName: { contains: 'croma', mode: 'insensitive' } }
  });
  const valuePlus = await prisma.store.count({
    where: { storeName: { contains: 'value plus', mode: 'insensitive' } }
  });
  const vasanth = await prisma.store.count({
    where: { storeName: { contains: 'vasanth', mode: 'insensitive' } }
  });
  const hotspot = await prisma.store.count({
    where: { storeName: { contains: 'hotspot', mode: 'insensitive' } }
  });
  const vijaySales = await prisma.store.count({
    where: { storeName: { contains: 'vijay sales', mode: 'insensitive' } }
  });
  const vsRaw = await prisma.store.count({
    where: { storeName: { contains: 'vs', mode: 'insensitive' } }
  });

  console.log(`Reliance count: ${reliance}`);
  console.log(`Croma count: ${croma}`);
  console.log(`Value Plus count: ${valuePlus}`);
  console.log(`Vasanth count: ${vasanth}`);
  console.log(`Hotspot count: ${hotspot}`);
  console.log(`Vijay Sales count: ${vijaySales}`);
  console.log(`Raw "vs" count: ${vsRaw}`);

  // Fetch all stores to perform filtering programmatically in memory
  // to be absolutely sure and precise, and analyze any other patterns.
  const allStores = await prisma.store.findMany({
    select: { id: true, storeName: true, city: true, latitude: true, longitude: true }
  });

  // Filter local stores
  const excludeTerms = ['reliance', 'croma', 'value plus', 'vasanth', 'hotspot', 'vijay sales'];
  const localStores = allStores.filter(store => {
    if (!store.storeName) return true;
    const nameLower = store.storeName.toLowerCase();
    return !excludeTerms.some(term => nameLower.includes(term));
  });

  console.log(`\nFiltered local stores count (excluding the 6 major chains): ${localStores.length}`);

  // Let's also see if any of these local stores have 'vs' in their name and what they are
  const vsLocalStores = localStores.filter(store => {
    if (!store.storeName) return false;
    return store.storeName.toLowerCase().includes('vs');
  });
  console.log(`Local stores containing "vs" count: ${vsLocalStores.length}`);
  if (vsLocalStores.length > 0) {
    console.log("Sample of local stores with 'vs':");
    console.log(vsLocalStores.slice(0, 10).map(s => s.storeName));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
