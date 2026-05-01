import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import "dotenv/config";

const prisma = new PrismaClient()

async function main() {
    console.log("Fetching stores from local database...");
    const allStores = await prisma.store.findMany({
        select: {
            id: true,
            storeName: true,
            city: true,
            latitude: true,
            longitude: true,
            fullAddress: true
        }
    });

    const withCoords = [];
    const missingCoords = [];

    for (const store of allStores) {
        if (store.latitude !== null && store.longitude !== null) {
            withCoords.push({
                "Store ID": store.id,
                "Store Name": store.storeName,
                "City": store.city,
                "Latitude": store.latitude,
                "Longitude": store.longitude,
                "Full Address": store.fullAddress
            });
        } else {
            missingCoords.push({
                "Store ID": store.id,
                "Store Name": store.storeName,
                "City": store.city,
                "Latitude": "N/A",
                "Longitude": "N/A",
                "Full Address": store.fullAddress
            });
        }
    }

    console.log(`Found ${withCoords.length} stores with coordinates.`);
    console.log(`Found ${missingCoords.length} stores missing coordinates.`);

    const wb = XLSX.utils.book_new();
    
    const wsWith = XLSX.utils.json_to_sheet(withCoords);
    XLSX.utils.book_append_sheet(wb, wsWith, "With Coordinates");
    
    const wsMissing = XLSX.utils.json_to_sheet(missingCoords);
    XLSX.utils.book_append_sheet(wb, wsMissing, "Missing Coordinates");

    const fileName = "local_store_coordinates_export.xlsx";
    XLSX.writeFile(wb, fileName);

    console.log(`Successfully exported to ${fileName}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
