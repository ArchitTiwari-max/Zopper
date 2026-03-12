import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const stores = await prisma.store.findMany({
        where: {
            storeName: {
                contains: 'Model Town',
                mode: 'insensitive'
            }
        },
        select: {
            storeName: true,
            city: true,
            latitude: true,
            longitude: true
        }
    })
    console.log(JSON.stringify(stores, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
