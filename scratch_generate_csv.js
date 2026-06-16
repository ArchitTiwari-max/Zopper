const fs = require('fs');
const path = require('path');

const localStoresJsonPath = '/Users/harshdeepsingh/salesdost_zopper/scratch/local_stores_to_geocode.json';
const csvOutputPath = '/Users/harshdeepsingh/salesdost_zopper/scratch/local_stores_to_geocode.csv';

function main() {
  if (!fs.existsSync(localStoresJsonPath)) {
    console.error('Local stores JSON file does not exist.');
    return;
  }

  const stores = JSON.parse(fs.readFileSync(localStoresJsonPath, 'utf8'));
  console.log(`Loaded ${stores.length} stores to convert to CSV.`);

  let csvContent = 'ID,StoreName,City,Latitude,Longitude,GoogleMapsLink\n';

  stores.forEach(store => {
    // Escape quotes in store name
    const safeStoreName = store.storeName ? `"${store.storeName.replace(/"/g, '""')}"` : '""';
    const city = store.city || '';
    const lat = store.latitude !== null ? store.latitude : '';
    const lng = store.longitude !== null ? store.longitude : '';
    const mapLink = store.latitude !== null && store.longitude !== null
      ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}`
      : '';

    csvContent += `${store.id},${safeStoreName},"${city}",${lat},${lng},"${mapLink}"\n`;
  });

  fs.writeFileSync(csvOutputPath, csvContent);
  console.log(`Successfully generated CSV at: ${csvOutputPath}`);
}

main();
