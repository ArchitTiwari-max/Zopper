const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const stores = await prisma.store.findMany({
        where: {
            storeName: { contains: 'croma', mode: 'insensitive' }
        },
        select: { id: true, storeName: true, city: true },
        take: 10
    });

    console.log(JSON.stringify(stores, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
