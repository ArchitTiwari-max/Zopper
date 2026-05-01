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
    if (!GOOGLE_API_KEY) {
        console.error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env");
        return null;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
        const response = await axios.get(url);
        
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const location = response.data.results[0].geometry.location;
            return { lat: location.lat, lng: location.lng };
        }
        return null;
    } catch (error: any) {
        return null;
    }
}

async function main() {
    console.log("Fetching all stores to find missing coordinates...");
    
    // Fetch all stores into memory
    const allStores = await prisma.store.findMany({
        select: { id: true, storeName: true, city: true, latitude: true, longitude: true }
    });

    const missingStores = allStores.filter(s => s.latitude === null || s.longitude === null);

    console.log(`Found ${missingStores.length} stores missing coordinates. Starting geocoding process...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < missingStores.length; i++) {
        const store = missingStores[i];
        const cleanedName = cleanStoreName(store.storeName);
        const searchAddress = `${cleanedName}, ${store.city || ''}, India`;
        
        const coords = await geocode(searchAddress);
        
        if (coords) {
            await prisma.store.update({
                where: { id: store.id },
                data: { latitude: coords.lat, longitude: coords.lng }
            });
            successCount++;
            if (i % 20 === 0) console.log(`[${i+1}/${missingStores.length}] ✅ Updated: ${store.storeName} -> Lat: ${coords.lat}, Lng: ${coords.lng}`);
        } else {
            failCount++;
            if (i % 20 === 0) console.log(`[${i+1}/${missingStores.length}] ❌ Failed: ${searchAddress}`);
        }
        
        // Small delay to prevent API rate limiting
        await new Promise(r => setTimeout(r, 150));
    }

    console.log(`\n================================`);
    console.log(`FINISHED PROCESSING`);
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed to find: ${failCount}`);
    console.log(`================================`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
