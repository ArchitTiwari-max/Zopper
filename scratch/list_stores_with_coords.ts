import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const stores = await prisma.store.findMany({
        where: {
            latitude: { not: null },
            longitude: { not: null }
        },
        select: {
            id: true,
            storeName: true,
            city: true,
            latitude: true,
            longitude: true
        }
    });

    console.log(`Found ${stores.length} stores with coordinates.`);
    if (stores.length > 0) {
        console.log('\nTop 50 stores with coordinates:');
        console.table(stores.slice(0, 50));
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
