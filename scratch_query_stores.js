const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      storeName: true,
      city: true,
      latitude: true,
      longitude: true,
    },
  });

  const totalStores = await prisma.store.count();

  console.log(`Found ${totalStores} total stores in DB.`);
  console.log(`Exporting ${stores.length} stores with lat/long data.`);

  let csvContent = "ID,StoreName,City,Latitude,Longitude,GoogleMapsLink\n";
  
  stores.forEach(store => {
    // Escape quotes in storeName
    const safeStoreName = `"${store.storeName ? store.storeName.replace(/"/g, '""') : ''}"`;
    const city = store.city || '';
    const mapLink = `https://www.google.com/maps?q=${store.latitude},${store.longitude}`;
    csvContent += `${store.id},${safeStoreName},"${city}",${store.latitude},${store.longitude},${mapLink}\n`;
  });

  const outputPath = path.join(__dirname, 'scratch', 'store_locations.csv');
  
  // Ensure scratch directory exists
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  fs.writeFileSync(outputPath, csvContent);
  console.log(`Saved complete list to ${outputPath}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
