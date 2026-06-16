const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
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
      state: true,
      fullAddress: true,
      storeChannel: true,
      latitude: true,
      longitude: true
    }
  });

  console.log(`Found ${missingStores.length} stores missing latitude or longitude.`);

  // Write to CSV
  const headers = ['Store ID', 'Store Name', 'City', 'State', 'Store Channel', 'Full Address', 'Latitude', 'Longitude'];
  const csvRows = [headers.join(',')];

  missingStores.forEach(store => {
    const row = [
      store.id || '',
      `"${(store.storeName || '').replace(/"/g, '""')}"`,
      `"${(store.city || '').replace(/"/g, '""')}"`,
      `"${(store.state || '').replace(/"/g, '""')}"`,
      `"${(store.storeChannel || '').replace(/"/g, '""')}"`,
      `"${(store.fullAddress || '').replace(/"/g, '""')}"`,
      store.latitude !== null ? store.latitude : 'null',
      store.longitude !== null ? store.longitude : 'null'
    ];
    csvRows.push(row.join(','));
  });

  const outputPath = path.join(__dirname, 'stores_no_lat_long.csv');
  fs.writeFileSync(outputPath, csvRows.join('\n'));
  console.log(`Saved list of stores with missing coordinates to: ${outputPath}`);

  // Also print the first 20 as sample in the console
  console.log('\nSample of 20 stores missing coordinates:');
  missingStores.slice(0, 20).forEach((store, index) => {
    console.log(`${index + 1}. ID: ${store.id} | Name: "${store.storeName}" | City: ${store.city} | Channel: ${store.storeChannel}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
