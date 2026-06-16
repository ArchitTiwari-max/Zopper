const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanStoreName(storeName, city) {
    // Replace hyphens and parentheses with spaces
    let cleanName = storeName.replace(/[-\(\)]/g, ' ');
    
    // Remove the city name from the string if it exists
    if (city) {
        const cityRegex = new RegExp(`\\b${city}\\b`, 'gi');
        cleanName = cleanName.replace(cityRegex, '');
    }

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

    console.log('📦 Fetching Croma stores from database...\n');
    
    // Fetch only Croma stores
    const cromaStores = await prisma.store.findMany({
        where: {
            storeName: { contains: 'croma', mode: 'insensitive' }
        },
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    console.log(`Found ${cromaStores.length} Croma stores in total.\n`);
    
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < cromaStores.length; i++) {
        const store = cromaStores[i];
        
        // Remove city from the middle of the name
        const cleanedName = cleanStoreName(store.storeName, store.city);
        
        // Put the database city as suffix, then India
        const citySuffix = store.city ? `, ${store.city}` : '';
        const query = `${cleanedName}${citySuffix}, India`;
        
        process.stdout.write(`[${i + 1}/${cromaStores.length}] Searching: "${query}" ... `);
        
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

    console.log(`\n✅ Finished Processing Croma Stores!`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed / Not Found: ${failed}`);
}

main().catch(async err => {
    console.error('Fatal error:', err);
}).finally(async () => {
    await prisma.$disconnect();
});
