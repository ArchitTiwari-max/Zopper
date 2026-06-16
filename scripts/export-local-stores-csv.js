const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();

// Same exclusion logic as geocode-local-stores.js
const excludeTerms = [
    'reliance',
    'croma',
    'value plus',
    'vasanth',
    'hotspot',
    'vijay sales'
];

function isLocalStore(store) {
    if (!store.storeName) return true;
    const nameLower = store.storeName.toLowerCase();
    if (excludeTerms.some(term => nameLower.includes(term))) return false;
    if (nameLower.includes('vs-') || nameLower.startsWith('vs ')) return false;
    return true;
}

function escapeCsvField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Wrap in quotes if contains comma, newline, or double-quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function getMapsLink(lat, lng) {
    if (lat == null || lng == null) return '';
    return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function main() {
    console.log('📦 Fetching local stores from database...\n');

    const allStores = await prisma.store.findMany({
        select: {
            id: true,
            storeName: true,
            city: true,
            latitude: true,
            longitude: true,
        },
    });

    const localStores = allStores.filter(isLocalStore);
    console.log(`Found ${localStores.length} local stores.\n`);

    const headers = ['Store ID', 'Store Name', 'City', 'Latitude', 'Longitude', 'Google Maps Link'];

    const rows = localStores.map(store => [
        escapeCsvField(store.id),
        escapeCsvField(store.storeName),
        escapeCsvField(store.city),
        escapeCsvField(store.latitude),
        escapeCsvField(store.longitude),
        escapeCsvField(getMapsLink(store.latitude, store.longitude)),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const outputPath = path.join(__dirname, 'local-stores.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf8');

    console.log(`✅ CSV exported to: ${outputPath}`);
    console.log(`   Total stores: ${localStores.length}`);
    const withCoords = localStores.filter(s => s.latitude != null && s.longitude != null).length;
    const withoutCoords = localStores.length - withCoords;
    console.log(`   With coordinates (has Maps link): ${withCoords}`);
    console.log(`   Without coordinates (no Maps link): ${withoutCoords}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
}).finally(async () => {
    await prisma.$disconnect();
});
