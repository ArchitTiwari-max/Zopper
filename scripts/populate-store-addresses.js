/**
 * scripts/populate-store-addresses.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Populates missing 'fullAddress' fields for stores that have coordinates (lat/lng)
 * using the Google Maps Reverse Geocoding API.
 * 
 * Usage:
 *   node scripts/populate-store-addresses.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function reverseGeocode(lat, lng) {
    try {
        const { data } = await axios.get(
            'https://maps.googleapis.com/maps/api/geocode/json',
            {
                params: {
                    latlng: `${lat},${lng}`,
                    key: GOOGLE_API_KEY
                }
            }
        );

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            // results[0] contains the most specific matched address
            return {
                address: data.results[0].formatted_address,
                status: 'OK'
            };
        }
        return {
            address: null,
            status: data.status || 'ZERO_RESULTS'
        };
    } catch (error) {
        return {
            address: null,
            status: `ERROR: ${error.message}`
        };
    }
}

async function main() {
    if (!GOOGLE_API_KEY) {
        console.error('❌ Please define GOOGLE_MAPS_API_KEY in your .env file.');
        process.exit(1);
    }

    console.log('📦 Querying stores from database that have coordinates but missing/blank fullAddress...');
    const stores = await prisma.store.findMany({
        where: {
            latitude: { not: null },
            longitude: { not: null },
            OR: [
                { fullAddress: null },
                { fullAddress: '' }
            ]
        },
        select: {
            id: true,
            storeName: true,
            latitude: true,
            longitude: true
        }
    });

    console.log(`Found ${stores.length} stores to update.\n`);

    if (stores.length === 0) {
        console.log('✅ All stores with coordinates already have a fullAddress.');
        return;
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        const lat = store.latitude;
        const lng = store.longitude;

        process.stdout.write(`[${i + 1}/${stores.length}] Geocoding Store "${store.storeName}" (${lat}, ${lng}) ... `);

        const res = await reverseGeocode(lat, lng);

        if (res.status === 'OK' && res.address) {
            console.log(`✔ "${res.address}"`);
            
            // Update database
            await prisma.store.update({
                where: { id: store.id },
                data: { fullAddress: res.address }
            });
            updated++;
        } else {
            console.log(`✗ Failed (${res.status})`);
            failed++;
        }

        // Delay to respect API limits (150ms)
        await sleep(150);
    }

    console.log(`\n✅ Finished populating addresses!`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed / Skipped:     ${failed}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
