import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import "dotenv/config";

const prisma = new PrismaClient()
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function cleanStoreName(name: string): string {
    let cleanName = name.trim();
    
    // Remove "Hitachi" or "Haier" prefix (case insensitive, handling hyphens and spaces)
    const prefixRegex = /^(hitachi|haier)\s*(-)?\s*/i;
    cleanName = cleanName.replace(prefixRegex, '').trim();

    return cleanName.length > 0 ? cleanName : name.trim();
}

async function geocode(address: string): Promise<{lat: number, lng: number} | null> {
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
        const response = await axios.get(url);
        
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const location = response.data.results[0].geometry.location;
            return { lat: location.lat, lng: location.lng };
        } else {
            console.log(`   └─ Geocoding API Status: ${response.data.status}`);
            return null;
        }
    } catch (error: any) {
        console.error(`   └─ Error:`, error.message);
        return null;
    }
}

async function main() {
    console.log("Fetching sample stores missing coordinates (filtering for Hitachi/Haier)...");
    
    const missingStores = await prisma.store.findMany({
        where: {
            OR: [
                { latitude: null },
                { longitude: null }
            ],
            storeName: {
                contains: "Hitachi", mode: "insensitive"
            }
        },
        take: 3 // Just grabbing 3 to demonstrate
    });

    if (missingStores.length === 0) {
        console.log("No missing stores found with 'Hitachi' in the name for this test. Fetching any 3 missing stores instead...");
        const fallbackStores = await prisma.store.findMany({
            where: { OR: [{ latitude: null }, { longitude: null }] },
            take: 3
        });
        missingStores.push(...fallbackStores);
    }

    console.log(`\n--- DRY RUN TEST (${missingStores.length} stores) ---`);

    for (const store of missingStores) {
        const cleanedName = cleanStoreName(store.storeName);
        const searchAddress = `${cleanedName}, ${store.city}, India`;
        
        console.log(`\n📍 DB Name : "${store.storeName}"`);
        console.log(`🔍 Searching: "${searchAddress}"`);

        const coords = await geocode(searchAddress);
        
        if (coords) {
            console.log(`✅ Result   : Lat ${coords.lat}, Lng ${coords.lng}`);
            console.log(`   (Would update database here, keeping name as "${store.storeName}")`);
        } else {
            console.log(`❌ Result   : Not found by Google Maps`);
        }
        
        await new Promise(r => setTimeout(r, 200));
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
