const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const storeNames = [
        "Value Plus -M/S House Of Electronics (Gandhi Nagar)",
        "Value Plus -M/S Jai Hind Electronics (Salempur)",
        "Value Plus -M/S Rajput Enterprises (Khalilabad)",
        "Value Plus -M/S Electro World And Furniture (Barhalganj)"
    ];

    const stores = await prisma.store.findMany({
        where: {
            storeName: {
                in: storeNames
            }
        },
        select: {
            id: true,
            storeName: true,
            city: true,
            latitude: true,
            longitude: true
        }
    });

    console.log(JSON.stringify(stores, null, 2));
    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
