const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanStoreName(storeName, city) {
    // 1. Remove "ASP" case-insensitively
    let cleanName = storeName.replace(/\bASP\b/gi, '');
    
    // 2. Remove the city name from the string if it exists to avoid duplication in search
    if (city) {
        const escapedCity = city.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const cityRegex = new RegExp(`\\b${escapedCity}\\b`, 'gi');
        cleanName = cleanName.replace(cityRegex, '');
    }

    // 3. Clean up empty parentheses
    cleanName = cleanName.replace(/\(\s*\)/g, ' ');

    // 4. Replace hyphens and parentheses with spaces
    cleanName = cleanName.replace(/[-\(\)]/g, ' ');

    // 5. Clean up extra spaces
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

    console.log('📦 Fetching all stores from database...\n');
    const allStores = await prisma.store.findMany({
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    // Exclusion terms
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
        
        // Exclude major chains
        if (excludeTerms.some(term => nameLower.includes(term))) {
            return false;
        }

        // Exclude Vijay Sales (VS) shorthand
        if (nameLower.includes('vs-') || nameLower.startsWith('vs ')) {
            return false;
        }

        return true;
    });

    console.log(`Found ${localStores.length} Local stores in total to geocode.\n`);
    
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < localStores.length; i++) {
        const store = localStores[i];
        
        const cleanedName = cleanStoreName(store.storeName, store.city);
        const citySuffix = store.city ? `, ${store.city}` : '';
        const query = `${cleanedName}${citySuffix}, India`;
        
        process.stdout.write(`[${i + 1}/${localStores.length}] Searching: "${query}" ... `);
        
        try {
            const geo = await geocode(query);

            if (geo.status === 'Found') {
                console.log(`✔ Found coords: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
                
                await prisma.store.update({
                    where: { id: store.id },
                    data: { latitude: geo.lat, longitude: geo.lng },
                });
                updated++;
            } else {
                console.log(`✗ Failed to find on Maps (${geo.status})`);
                failed++;
            }
        } catch (err) {
            console.log(`✗ Error: ${err.message}`);
            failed++;
        }

        // Delay to avoid hitting Google Maps API rate limits
        await sleep(200);
    }

    console.log(`\n✅ Finished Processing Local Stores!`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed / Not Found: ${failed}`);
}

main().catch(async err => {
    console.error('Fatal error:', err);
}).finally(async () => {
    await prisma.$disconnect();
});
