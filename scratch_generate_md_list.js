const fs = require('fs');
const path = require('path');

const localStoresJsonPath = '/Users/harshdeepsingh/salesdost_zopper/scratch/local_stores_to_geocode.json';
const artifactPath = '/Users/harshdeepsingh/.gemini/antigravity-ide/brain/66f28d87-b711-4c8b-b952-824bf850f678/local_stores_to_geocode.md';

function main() {
  if (!fs.existsSync(localStoresJsonPath)) {
    console.error('Local stores JSON file does not exist.');
    return;
  }

  const stores = JSON.parse(fs.readFileSync(localStoresJsonPath, 'utf8'));
  console.log(`Loaded ${stores.length} stores.`);

  // Group stores by city
  const cityGroups = {};
  stores.forEach(store => {
    const city = store.city || 'Unknown City';
    if (!cityGroups[city]) {
      cityGroups[city] = [];
    }
    cityGroups[city].push(store);
  });

  // Sort cities alphabetically
  const sortedCities = Object.keys(cityGroups).sort();

  let markdownContent = `# Local Stores Pending Geocoding\n\n`;
  markdownContent += `We have identified **${stores.length}** local stores that do not belong to the 6 major excluded chains (Reliance, Croma, Value Plus, Vasanth, Hotspot, Vijay Sales/VS). Overwriting coordinates is allowed for these stores.\n\n`;
  markdownContent += `> [!NOTE]\n`;
  markdownContent += `> Out of the ${stores.length} stores, **${stores.filter(s => s.latitude !== null && s.longitude !== null).length}** already have coordinates in the database (which can be updated/rewritten), and **${stores.filter(s => s.latitude === null || s.longitude === null).length}** are missing coordinates.\n\n`;
  markdownContent += `## List of Stores Grouped by City\n\n`;

  sortedCities.forEach(city => {
    const cityStores = cityGroups[city];
    markdownContent += `### 🏙️ ${city} (${cityStores.length} stores)\n\n`;
    markdownContent += `| # | Store ID | Store Name | Current Latitude | Current Longitude |\n`;
    markdownContent += `|---|----------|------------|------------------|-------------------|\n`;
    cityStores.forEach((store, index) => {
      const lat = store.latitude !== null ? store.latitude : '*None*';
      const lng = store.longitude !== null ? store.longitude : '*None*';
      markdownContent += `| ${index + 1} | \`${store.id}\` | ${store.storeName} | ${lat} | ${lng} |\n`;
    });
    markdownContent += `\n`;
  });

  // Ensure artifacts folder exists
  const artifactDir = path.dirname(artifactPath);
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  fs.writeFileSync(artifactPath, markdownContent);
  console.log(`Saved Markdown artifact to ${artifactPath}`);
}

main();
