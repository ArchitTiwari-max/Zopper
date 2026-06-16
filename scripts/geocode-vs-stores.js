const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Cleans the name and builds a search string for Google Maps as requested:
// "VS-Virar Br" -> "Vijay Sales - Virar br, {city}, India"
function buildSearchQuery(storeName, city) {
    // Case-insensitive replace of "VS-" or "VS " or "VS" at the start of the string with "Vijay Sales - "
    let formattedName = storeName.replace(/^vs-?\s*/i, 'Vijay Sales - ');
    
    // Clean up any double hyphens or extra spaces
    formattedName = formattedName.replace(/\s+/g, ' ').trim();

    return `${formattedName}, ${city}, India`;
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
        console.error('Usage: node scripts/geocode-vs-stores.js YOUR_API_KEY');
        process.exit(1);
    }

    console.log('📦 Fetching VS stores from database...\n');
    
    // Fetch only Vijay Sales (VS) stores
    const vsStores = await prisma.store.findMany({
        where: {
            storeName: { contains: 'vs-', mode: 'insensitive' }
        },
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    console.log(`Found ${vsStores.length} VS stores in total.\n`);
    
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < vsStores.length; i++) {
        const store = vsStores[i];
        const query = buildSearchQuery(store.storeName, store.city);
        
        process.stdout.write(`[${i + 1}/${vsStores.length}] Searching: "${query}" ... `);

        try {
            const geo = await geocode(query);
            if (geo.status === 'Found') {
                console.log(`✔  Found coords: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
                
                // Update the database immediately
                await prisma.store.update({
                    where: { id: store.id },
                    data: { latitude: geo.lat, longitude: geo.lng },
                });
                updated++;
            } else {
                console.log(`✗  Not found on Maps (${geo.status})`);
                failed++;
            }
        } catch (err) {
            console.log(`✗  Error: ${err.message}`);
            failed++;
        }

        // Delay to avoid hitting Google Maps API rate limits
        await sleep(200);
    }

    console.log(`\n✅ Finished Processing VS Stores!`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed / Not Found: ${failed}`);
}

main().catch(async err => {
    console.error('Fatal error:', err);
}).finally(async () => {
    await prisma.$disconnect();
});
