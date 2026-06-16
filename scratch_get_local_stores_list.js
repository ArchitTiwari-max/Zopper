const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Fetching all stores from DB...');
  const allStores = await prisma.store.findMany({
    select: {
      id: true,
      storeName: true,
      city: true,
      latitude: true,
      longitude: true
    }
  });

  console.log(`📋 Total stores fetched: ${allStores.length}`);

  // Define exclusion terms
  const excludeTerms = [
    'reliance',
    'croma',
    'value plus',
    'vasanth',
    'hotspot',
    'vijay sales'
  ];

  const localStores = allStores.filter(store => {
    if (!store.storeName) return true;
    const nameLower = store.storeName.toLowerCase();
    
    // Check if it matches any of the main terms
    const matchesExclude = excludeTerms.some(term => nameLower.includes(term));
    if (matchesExclude) return false;

    // Check if it is a VS store (e.g. starts with VS or contains VS-)
    if (nameLower.includes('vs-') || nameLower.startsWith('vs ')) {
      return false;
    }

    return true;
  });

  console.log(`✨ Local stores found: ${localStores.length}`);

  // Save the complete list as a JSON artifact
  const scratchDir = path.join(__dirname, 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const outputPath = path.join(scratchDir, 'local_stores_to_geocode.json');
  fs.writeFileSync(outputPath, JSON.stringify(localStores, null, 2));
  console.log(`💾 Saved list of local stores to: ${outputPath}`);

  // Output stats on coordinates presence
  const withCoords = localStores.filter(s => s.latitude !== null && s.longitude !== null);
  const withoutCoords = localStores.filter(s => s.latitude === null || s.longitude === null);
  console.log(`📍 Stores with existing coordinates: ${withCoords.length}`);
  console.log(`🔍 Stores missing coordinates: ${withoutCoords.length}`);

  // Print first 50 stores to console
  console.log('\n--- SAMPLE / PREVIEW OF LOCAL STORES TO GEOCODE (FIRST 50) ---');
  localStores.slice(0, 50).forEach((store, index) => {
    console.log(`${index + 1}. [${store.id}] ${store.storeName} (${store.city || 'No City'}) - Coords: ${store.latitude !== null ? store.latitude + ',' + store.longitude : 'None'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
