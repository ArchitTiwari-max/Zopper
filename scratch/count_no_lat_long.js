const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const totalStores = await prisma.store.count();
  
  const storesWithLatLong = await prisma.store.count({
    where: {
      latitude: { not: null },
      longitude: { not: null }
    }
  });

  const storesMissingLatOrLong = await prisma.store.count({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });

  const storesWithZeroCoords = await prisma.store.count({
    where: {
      OR: [
        { latitude: 0 },
        { longitude: 0 }
      ]
    }
  });

  console.log('--- STORE COORDINATES STATS ---');
  console.log(`Total Stores: ${totalStores}`);
  console.log(`Stores with both Latitude & Longitude: ${storesWithLatLong}`);
  console.log(`Stores missing Latitude or Longitude (null): ${storesMissingLatOrLong}`);
  console.log(`Stores with Latitude or Longitude as 0: ${storesWithZeroCoords}`);
  console.log('--------------------------------\n');

  // Let's analyze what types of stores are missing lat/long
  const missingStores = await prisma.store.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    },
    select: {
      id: true,
      storeName: true,
      city: true,
      storeChannel: true
    }
  });

  // Category/Chain analysis
  const chains = {
    'Reliance': 0,
    'Croma': 0,
    'Value Plus': 0,
    'Vasanth': 0,
    'Hotspot': 0,
    'Vijay Sales': 0,
    'Others': 0
  };

  const cities = {};

  missingStores.forEach(store => {
    const nameLower = (store.storeName || '').toLowerCase();
    let matched = false;
    for (const chain of Object.keys(chains)) {
      if (chain === 'Others') continue;
      if (nameLower.includes(chain.toLowerCase()) || (chain === 'Vijay Sales' && (nameLower.includes('vs-') || nameLower.startsWith('vs ')))) {
        chains[chain]++;
        matched = true;
        break;
      }
    }
    if (!matched) {
      chains['Others']++;
    }

    const city = store.city || 'Unknown';
    cities[city] = (cities[city] || 0) + 1;
  });

  console.log('Breakdown of stores with missing coordinates by Chain/Brand:');
  Object.entries(chains).forEach(([chain, count]) => {
    console.log(`- ${chain}: ${count}`);
  });

  console.log('\nTop 10 Cities with missing coordinates:');
  const sortedCities = Object.entries(cities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedCities.forEach(([city, count]) => {
    console.log(`- ${city}: ${count}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
