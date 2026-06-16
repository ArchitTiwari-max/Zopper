const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanStoreName(storeName) {
    // Replace hyphens and parentheses with spaces
    let cleanName = storeName.replace(/[-\(\)]/g, ' ');
    // Remove numbers (like store IDs: 1129, 1105, etc.)
    cleanName = cleanName.replace(/\d+/g, ' ');
    // Clean up extra spaces
    cleanName = cleanName.replace(/\s+/g, ' ').trim();
    return cleanName;
}

async function geocode(query) {
    const { data } = await axios.get(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
        { params: { query, key: GOOGLE_API_KEY } }
    );
    if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng, status: 'Found' };
    }
    return { lat: null, lng: null, status: data.status || 'ZERO_RESULTS' };
}

async function main() {
    if (!GOOGLE_API_KEY) {
        console.error('❌ Please provide a Google Maps API Key as an argument or in .env as GOOGLE_MAPS_API_KEY.');
        process.exit(1);
    }

    console.log('📦 Fetching Vasanth & Co stores from database...\n');
    
    // Fetch only Vasanth & Co stores
    const vasanthStores = await prisma.store.findMany({
        where: {
            storeName: { contains: 'vasanth', mode: 'insensitive' }
        },
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    console.log(`Found ${vasanthStores.length} Vasanth & Co stores in total.\n`);
    
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < vasanthStores.length; i++) {
        const store = vasanthStores[i];
        const cleanedName = cleanStoreName(store.storeName);
        
        // City must be there in the suffix
        const citySuffix = store.city ? `, ${store.city}` : '';
        const query = `${cleanedName}${citySuffix}, India`;
        
        process.stdout.write(`[${i + 1}/${vasanthStores.length}] Searching: "${query}" ... `);
        
        const geo = await geocode(query);

        if (geo.status === 'Found') {
            console.log(`✔ Found coords: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
            
            // Update the database immediately
            await prisma.store.update({
                where: { id: store.id },
                data: { latitude: geo.lat, longitude: geo.lng },
            });
            updated++;
        } else {
            console.log(`✗ Failed to find on Maps (${geo.status})`);
            failed++;
        }

        // Delay to avoid hitting Google Maps API rate limits
        await sleep(200);
    }

    console.log(`\n✅ Finished Processing Vasanth & Co Stores!`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed / Not Found: ${failed}`);
}

main().catch(async err => {
    console.error('Fatal error:', err);
}).finally(async () => {
    await prisma.$disconnect();
});
