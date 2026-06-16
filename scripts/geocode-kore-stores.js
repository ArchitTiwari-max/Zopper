const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanStoreName(storeName) {
    // Remove state suffix like " | Gj" or " | Up" at the end of the string
    let cleanName = storeName.replace(/\|\s*[a-zA-Z]{2}\s*$/i, '');
    
    // Replace "@" and other symbols like hyphens/parentheses with space
    cleanName = cleanName.replace(/[@\-\(\)]/g, ' ');
    
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

    console.log('📦 Fetching Kore stores from database...\n');
    
    // Fetch only Kore stores missing lat/long
    const koreStores = await prisma.store.findMany({
        where: {
            storeName: { contains: 'kore', mode: 'insensitive' },
            OR: [
                { latitude: null },
                { longitude: null }
            ]
        },
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    console.log(`Found ${koreStores.length} Kore stores missing coordinates.\n`);
    
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < koreStores.length; i++) {
        const store = koreStores[i];
        const cleanedName = cleanStoreName(store.storeName);
        
        // Use clean name + city + India as primary search query
        let query = store.city ? `${cleanedName}, ${store.city}, India` : `${cleanedName}, India`;
        process.stdout.write(`[${i + 1}/${koreStores.length}] Attempt 1: "${query}" ... `);
        
        let geo = await geocode(query);
        
        // Fallback to name + India if city-specific query failed
        if (geo.status !== 'Found' && store.city) {
            console.log(`✗ Not found. Falling back to Attempt 2 (without city)...`);
            await sleep(200);
            
            query = `${cleanedName}, India`;
            process.stdout.write(`         Attempt 2: "${query}" ... `);
            geo = await geocode(query);
        }

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

    console.log(`\n✅ Finished Processing Kore Stores!`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed / Not Found: ${failed}`);
}

main().catch(async err => {
    console.error('Fatal error:', err);
}).finally(async () => {
    await prisma.$disconnect();
});
