import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        // Find all Admin Visits and delete them
        // Assuming these are the only ones, or we can look up by Admin Name "Mayank Gupta"

        // First, verify what we have
        const visits = await prisma.adminVisit.findMany({
            include: {
                admin: true,
                store: true
            }
        });

        console.log("Found", visits.length, "admin visits.");

        for (const v of visits) {
            console.log(`- Visit ID: ${v.id}, Admin: ${v.admin?.name}, Store: ${v.store?.storeName}`);
        }

        // Since these are dummy visits from testing the admin form, we can just delete all of them 
        // or specifically the ones by Mayank Gupta today.
        // Let's delete all AdminVisits since they were just created today for testing.

        const count = await prisma.adminVisit.deleteMany({});

        console.log(`Deleted ${count.count} admin visits.`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect()
    }
}

main()
