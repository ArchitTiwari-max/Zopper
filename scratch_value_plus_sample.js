const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const vpStores = await prisma.store.findMany({
        where: {
            storeName: { contains: 'value plus', mode: 'insensitive' }
        },
        select: { id: true, storeName: true, city: true },
        take: 20
    });

    console.log(JSON.stringify(vpStores, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
