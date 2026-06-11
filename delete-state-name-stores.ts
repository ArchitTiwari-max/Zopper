import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        // List of store IDs that are actually state names (created by mistake)
        const stateNameStoreIds = [
            "Andhra Pradesh",
            "Arunachal Pradesh",
            "Assam",
            "Bihar",
            "Chandigarh",
            "Chattisgarh",
            "Delhi",
            "Goa",
            "Gujarat",
            "Haryana",
            "Himachal Pradesh",
            "Jammu & Kashmir",
            "Jharkhand",
            "Karnataka",
            "Madhya Pradesh",
            "Maharashtra",
            "Meghalaya",
            "Nagaland",
            "Orissa",
            "Punjab",
            "Rajasthan",
            "Sikkim",
            "Tamil Nadu",
            "Telangana",
            "Tripura",
            "Uttar Pradesh",
            "Uttarakhand",
            "West Bengal"
        ];

        console.log(`Attempting to delete ${stateNameStoreIds.length} stores with state names as IDs...`);
        console.log('Store IDs to delete:', stateNameStoreIds);

        // First, check if these stores exist and what data is linked to them
        const stores = await prisma.store.findMany({
            where: {
                id: {
                    in: stateNameStoreIds
                }
            },
            include: {
                _count: {
                    select: {
                        visits: true,
                        digitalVisits: true,
                        executiveStores: true,
                        salesRecords: true,
                        adminVisits: true,
                        targets: true,
                        storeBrands: true
                    }
                }
            }
        });

        console.log(`\nFound ${stores.length} stores to delete:`);
        for (const store of stores) {
            console.log(`\n- Store ID: ${store.id}`);
            console.log(`  Name: ${store.storeName}`);
            console.log(`  City: ${store.city}`);
            console.log(`  Visits: ${store._count.visits}`);
            console.log(`  Digital Visits: ${store._count.digitalVisits}`);
            console.log(`  Executive Assignments: ${store._count.executiveStores}`);
            console.log(`  Sales Records: ${store._count.salesRecords}`);
            console.log(`  Admin Visits: ${store._count.adminVisits}`);
            console.log(`  Targets: ${store._count.targets}`);
            console.log(`  Store Brands: ${store._count.storeBrands}`);
        }

        if (stores.length === 0) {
            console.log('\n✅ No stores found with these IDs. They may have already been deleted.');
            return;
        }

        // Delete related data first (in order of dependencies)
        console.log('\n🗑️  Deleting related data...');

        // 1. Delete StoreTargets (has onDelete: Cascade, but being explicit)
        const targetResult = await prisma.storeTarget.deleteMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        console.log(`   Deleted ${targetResult.count} store targets`);

        // 2. Delete StoreBrands
        const storeBrandResult = await prisma.storeBrand.deleteMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        console.log(`   Deleted ${storeBrandResult.count} store brands`);

        // 3. Delete ExecutiveStoreAssignments
        const assignmentResult = await prisma.executiveStoreAssignment.deleteMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        console.log(`   Deleted ${assignmentResult.count} executive assignments`);

        // 4. Delete SalesRecords
        const salesResult = await prisma.salesRecord.deleteMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        console.log(`   Deleted ${salesResult.count} sales records`);

        // 5. Delete StoreAlignment
        const alignmentResult = await prisma.storeAlignment.deleteMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        console.log(`   Deleted ${alignmentResult.count} store alignments`);

        // 6. Delete AdminVisits (including related issues and notifications)
        const adminVisits = await prisma.adminVisit.findMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        for (const visit of adminVisits) {
            // Admin visits don't have issues, so just delete them
            await prisma.adminVisit.delete({
                where: { id: visit.id }
            });
        }
        console.log(`   Deleted ${adminVisits.length} admin visits`);

        // 7. Delete DigitalVisits (including related issues)
        const digitalVisits = await prisma.digitalVisit.findMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        for (const dVisit of digitalVisits) {
            // Delete issues related to this digital visit
            const issues = await prisma.issue.findMany({
                where: { digitalVisitId: dVisit.id }
            });
            for (const issue of issues) {
                // Delete notifications for this issue
                await prisma.notification.deleteMany({
                    where: { issueId: issue.id }
                });
                // Delete assignments for this issue (and their notifications)
                const assignments = await prisma.assigned.findMany({
                    where: { issueId: issue.id }
                });
                for (const assignment of assignments) {
                    await prisma.notification.deleteMany({
                        where: { assignedId: assignment.id }
                    });
                    await prisma.assignReport.deleteMany({
                        where: { assignedId: assignment.id }
                    });
                }
                await prisma.assigned.deleteMany({
                    where: { issueId: issue.id }
                });
            }
            await prisma.issue.deleteMany({
                where: { digitalVisitId: dVisit.id }
            });
            // Delete digital visit
            await prisma.digitalVisit.delete({
                where: { id: dVisit.id }
            });
        }
        console.log(`   Deleted ${digitalVisits.length} digital visits (with issues)`);

        // 8. Delete Visits (including related issues, notifications)
        const visits = await prisma.visit.findMany({
            where: {
                storeId: {
                    in: stateNameStoreIds
                }
            }
        });
        for (const visit of visits) {
            // Delete notifications for this visit
            await prisma.notification.deleteMany({
                where: { visitId: visit.id }
            });
            // Delete issues related to this visit
            const issues = await prisma.issue.findMany({
                where: { visitId: visit.id }
            });
            for (const issue of issues) {
                // Delete notifications for this issue
                await prisma.notification.deleteMany({
                    where: { issueId: issue.id }
                });
                // Delete assignments for this issue (and their notifications)
                const assignments = await prisma.assigned.findMany({
                    where: { issueId: issue.id }
                });
                for (const assignment of assignments) {
                    await prisma.notification.deleteMany({
                        where: { assignedId: assignment.id }
                    });
                    await prisma.assignReport.deleteMany({
                        where: { assignedId: assignment.id }
                    });
                }
                await prisma.assigned.deleteMany({
                    where: { issueId: issue.id }
                });
            }
            await prisma.issue.deleteMany({
                where: { visitId: visit.id }
            });
            // Delete visit
            await prisma.visit.delete({
                where: { id: visit.id }
            });
        }
        console.log(`   Deleted ${visits.length} visits (with issues and notifications)`);

        // 9. Finally, delete the stores themselves
        const storeResult = await prisma.store.deleteMany({
            where: {
                id: {
                    in: stateNameStoreIds
                }
            }
        });

        console.log(`\n✅ Successfully deleted ${storeResult.count} stores!`);
        console.log('Store IDs deleted:', stateNameStoreIds.filter(id => 
            stores.some(s => s.id === id)
        ));

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await prisma.$disconnect()
    }
}

main()
