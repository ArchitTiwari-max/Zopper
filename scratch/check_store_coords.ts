import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const totalStores = await prisma.store.count();
    const storesWithCoords = await prisma.store.count({
        where: {
            latitude: { not: null },
            longitude: { not: null }
        }
    });
    const storesWithoutCoords = totalStores - storesWithCoords;

    console.log(`Total Stores: ${totalStores}`);
    console.log(`Stores with coordinates: ${storesWithCoords}`);
    console.log(`Stores without coordinates: ${storesWithoutCoords}`);
    
    if (storesWithoutCoords > 0) {
        const sampleMissing = await prisma.store.findMany({
            where: {
                OR: [
                    { latitude: null },
                    { longitude: null }
                ]
            },
            take: 5,
            select: {
                id: true,
                storeName: true,
                city: true
            }
        });
        console.log('\nSample stores missing coordinates:');
        console.log(JSON.stringify(sampleMissing, null, 2));
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
