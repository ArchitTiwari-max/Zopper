import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const visits = await prisma.visit.findMany({
            take: 10,
            select: { store: { select: { id: true } } }
        });

        // Get previous visit dates for these stores
        const storeIds = [...new Set(visits.map(v => v.store?.id).filter(Boolean))];
        console.log("Extracted storeIds:", storeIds);

        const previousVisitsRaw = await prisma.visit.findMany({
            where: { storeId: { in: storeIds } },
            select: { storeId: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });
        console.log("Raw prev visits count:", previousVisitsRaw.length);

        const storeVisitDates = new Map();
        for (const pv of previousVisitsRaw) {
            if (!pv.storeId) continue;
            if (!storeVisitDates.has(pv.storeId)) storeVisitDates.set(pv.storeId, []);
            storeVisitDates.get(pv.storeId).push(pv.createdAt);
        }

        console.log("Test successful.");
    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
