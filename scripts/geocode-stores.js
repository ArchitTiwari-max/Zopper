/**
 * scripts/geocode-stores.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Geocodes all stores in MongoDB using Google Places API.
 * 
 * STEP 1: Saves ALL coordinates to geocode_results.xlsx (local backup)
 * STEP 2: Writes coordinates back to MongoDB
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=AIza... node scripts/geocode-stores.js
 *
 * Re-run safely: skips stores that already have lat/lng in DB.
 * If DB write fails, re-import from backup:
 *   node scripts/geocode-stores.js --import-from-backup
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');

require('dotenv').config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.argv[2];
const BACKUP_FILE = path.join(__dirname, 'geocode_results.xlsx');
const IMPORT_FROM_BACKUP = process.argv.includes('--import-from-backup');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildSearchQuery(storeName, city) {
    let cleanName = storeName
        .replace(new RegExp(`(?:^|-)${city}(?:-|$)`, 'gi'), ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return `${cleanName}, ${city}, India`;
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

function saveBackup(rows) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Geocoded Stores');
    XLSX.writeFile(wb, BACKUP_FILE);
}

async function importFromBackup() {
    console.log(`\n📂 Importing coordinates from backup: ${BACKUP_FILE}\n`);
    const wb = XLSX.readFile(BACKUP_FILE);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const toImport = rows.filter(r => r.latitude != null && r.longitude != null);
    console.log(`Found ${toImport.length} rows with coordinates in backup.\n`);

    let updated = 0, failed = 0;
    for (let i = 0; i < toImport.length; i++) {
        const row = toImport[i];
        try {
            await prisma.store.update({
                where: { id: row.storeId },
                data: { latitude: parseFloat(row.latitude), longitude: parseFloat(row.longitude) },
            });
            updated++;
            if ((i + 1) % 100 === 0) console.log(`  [${i + 1}/${toImport.length}] Updated ${updated} stores...`);
        } catch (e) {
            failed++;
        }
    }
    console.log(`\n✅  Import complete! Updated: ${updated}, Failed: ${failed}\n`);
}

async function main() {
    if (IMPORT_FROM_BACKUP) {
        await importFromBackup();
        await prisma.$disconnect();
        return;
    }

    if (!GOOGLE_API_KEY) {
        console.error('❌  Set GOOGLE_MAPS_API_KEY=AIza... node scripts/geocode-stores.js');
        process.exit(1);
    }

    console.log('📦 Fetching all stores from database...\n');
    const stores = await prisma.store.findMany({
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true },
    });

    const toGeocode = stores.filter(s => s.latitude == null || s.longitude == null);
    const alreadyDone = stores.length - toGeocode.length;

    console.log(`Total stores:     ${stores.length}`);
    console.log(`Already geocoded: ${alreadyDone} (skipping)`);
    console.log(`To geocode:       ${toGeocode.length}\n`);

    if (toGeocode.length === 0) {
        console.log('✅  All stores already geocoded. Nothing to do.');
        await prisma.$disconnect();
        return;
    }

    // ── STEP 1: Geocode and save ALL results to Excel backup ──────────────────
    console.log('🌍 Step 1: Geocoding all stores and saving to backup Excel...\n');

    // Start with any previously geocoded stores in backup (if file exists)
    let backupRows = [];
    try {
        const existingWb = XLSX.readFile(BACKUP_FILE);
        backupRows = XLSX.utils.sheet_to_json(existingWb.Sheets[existingWb.SheetNames[0]]);
        console.log(`  Loaded ${backupRows.length} existing rows from backup file.\n`);
    } catch (_) { /* no existing backup, start fresh */ }

    let found = 0, notFound = 0;

    for (let i = 0; i < toGeocode.length; i++) {
        const store = toGeocode[i];
        const query = buildSearchQuery(store.storeName, store.city);
        process.stdout.write(`[${i + 1}/${toGeocode.length}] ${store.storeName} (${store.city}) ... `);

        try {
            const geo = await geocode(query);
            if (geo.status === 'Found') {
                console.log(`✔  ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
                found++;
                backupRows.push({ storeId: store.id, storeName: store.storeName, city: store.city, latitude: geo.lat, longitude: geo.lng });
            } else {
                console.log(`✗  ${geo.status}`);
                notFound++;
            }
        } catch (err) {
            console.log(`✗  Error: ${err.message}`);
            notFound++;
        }

        // Save backup every 50 stores
        if ((i + 1) % 50 === 0) {
            saveBackup(backupRows);
            console.log(`  💾 Backup saved (${i + 1}/${toGeocode.length})...\n`);
        }

        await sleep(150);
    }

    // Final backup save
    saveBackup(backupRows);
    console.log(`\n💾 Backup saved to: ${BACKUP_FILE}`);
    console.log(`   ✔ Geocoded: ${found} | ✗ Not found: ${notFound}\n`);

    // ── STEP 2: Write all coords to MongoDB ───────────────────────────────────
    console.log('🗄️  Step 2: Writing coordinates to MongoDB...\n');

    let dbUpdated = 0, dbFailed = 0;
    const rowsWithCoords = backupRows.filter(r => r.latitude != null);

    for (let i = 0; i < rowsWithCoords.length; i++) {
        const row = rowsWithCoords[i];
        try {
            await prisma.store.update({
                where: { id: row.storeId },
                data: { latitude: parseFloat(row.latitude), longitude: parseFloat(row.longitude) },
            });
            dbUpdated++;
        } catch (e) {
            dbFailed++;
        }
        if ((i + 1) % 200 === 0) {
            console.log(`  [${i + 1}/${rowsWithCoords.length}] DB updated: ${dbUpdated}...`);
        }
    }

    console.log(`\n✅  All done!`);
    console.log(`   DB updated: ${dbUpdated} | DB failed: ${dbFailed}`);
    console.log(`   Backup at:  ${BACKUP_FILE}`);
    console.log(`\n💡 If DB failed, re-import anytime with:`);
    console.log(`   node scripts/geocode-stores.js --import-from-backup\n`);

    await prisma.$disconnect();
}

main().catch(async err => {
    console.error('Fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
