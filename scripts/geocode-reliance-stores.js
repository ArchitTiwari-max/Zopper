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

// Cleans the name and builds a search string for Google Maps
// "Reliance Digital- RRL CDIT Navi Mumbai" -> "Reliance Digital Navi Mumbai, {city}, India"
function buildSearchQuery(storeName, city) {
    // Remove the internal store codes like "RRL CDIT" or "RRL D Xpress"
    let formattedName = storeName.replace(/-\s*RRL\s*(CDIT|D Xpress)?\s*/i, ' ');
    
    // Clean up extra spaces
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
        process.exit(1);
    }

    console.log('📦 Fetching Reliance stores from database...\n');
    
    // Fetch only Reliance stores
    const relianceStores = await prisma.store.findMany({
        where: {
            storeName: { contains: 'reliance', mode: 'insensitive' }
        },
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    console.log(`Found ${relianceStores.length} Reliance stores in total.\n`);
    
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < relianceStores.length; i++) {
        const store = relianceStores[i];
        const query = buildSearchQuery(store.storeName, store.city);
        
        process.stdout.write(`[${i + 1}/${relianceStores.length}] Searching: "${query}" ... `);

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

    console.log(`\n✅ Finished Processing Reliance Stores!`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed / Not Found: ${failed}`);
}

main().catch(async err => {
    console.error('Fatal error:', err);
}).finally(async () => {
    await prisma.$disconnect();
});
