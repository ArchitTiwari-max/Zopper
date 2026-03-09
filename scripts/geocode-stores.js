/**
 * scripts/geocode-stores.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script to geocode all stores in MongoDB using Google Places API.
 * Saves latitude + longitude back to each Store document.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=AIza... node scripts/geocode-stores.js
 *
 * - Skips stores that already have lat/lng (safe to re-run)
 * - Uses the same API key as your app
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

require('dotenv').config(); // loads .env file

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Builds a cleaned search query from store name + city.
 * Handles compound names like "Croma-Pune-Phoenix Mall Of The Millennium".
 */
function buildSearchQuery(storeName, city) {
    let cleanName = storeName
        .replace(new RegExp(`(?:^|-)${city}(?:-|$)`, 'gi'), ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return `${cleanName}, ${city}, India`;
}

/**
 * Calls Google Places Text Search API.
 */
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
        console.error('❌  GOOGLE_MAPS_API_KEY not set. Run:');
        console.error('    GOOGLE_MAPS_API_KEY=AIza... node scripts/geocode-stores.js');
        process.exit(1);
    }

    console.log('📦 Fetching all stores from database...\n');
    const stores = await prisma.store.findMany({
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    const toGeocode = stores.filter(s => s.latitude == null || s.longitude == null);
    const alreadyDone = stores.length - toGeocode.length;

    console.log(`Total stores:    ${stores.length}`);
    console.log(`Already geocoded: ${alreadyDone} (skipping)`);
    console.log(`To geocode:       ${toGeocode.length}\n`);

    if (toGeocode.length === 0) {
        console.log('✅  All stores are already geocoded. Nothing to do.');
        await prisma.$disconnect();
        return;
    }

    let found = 0;
    let failed = 0;

    for (let i = 0; i < toGeocode.length; i++) {
        const store = toGeocode[i];
        const query = buildSearchQuery(store.storeName, store.city);
        process.stdout.write(`[${i + 1}/${toGeocode.length}] ${query} ... `);

        try {
            const geo = await geocode(query);

            if (geo.status === 'Found') {
                await prisma.store.update({
                    where: { id: store.id },
                    data: { latitude: geo.lat, longitude: geo.lng },
                });
                console.log(`✔  ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
                found++;
            } else {
                console.log(`✗  ${geo.status}`);
                failed++;
            }
        } catch (err) {
            console.log(`✗  Error: ${err.message}`);
            failed++;
        }

        await sleep(150); // ~7 req/sec, well within quota
    }

    console.log(`\n✅  Geocoding complete!`);
    console.log(`    ✔ Updated: ${found}`);
    console.log(`    ✗ Failed:  ${failed}`);
    console.log(`\n💡 Re-run this script any time to geocode new stores added later.\n`);

    await prisma.$disconnect();
}

main().catch(async err => {
    console.error('Fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
