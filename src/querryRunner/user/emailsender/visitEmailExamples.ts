import { PrismaClient } from '@prisma/client';
import { sendDailyVisitSummaryToAdmins, sendVisitNotificationToExecutive } from './mailer';

const prisma = new PrismaClient();

/**
 * Example: Send visit notification when an executive submits a visit
 * Call this function after a visit is created in the database
 */
export async function onVisitCreated(visitId: string) {
    try {
        // Fetch the visit with executive, store, and user details
        const visit = await prisma.visit.findUnique({
            where: { id: visitId },
            include: {
                executive: {
                    include: {
                        user: true // Get user to access email
                    }
                },
                store: true
            }
        });

        if (!visit) {
            console.error('Visit not found');
            return;
        }

        // Get today's start and end time (IST timezone)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Count today's visits for this executive
        const todayVisitCount = await prisma.visit.count({
            where: {
                executiveId: visit.executiveId,
                createdAt: {
                    gte: todayStart,
                    lte: todayEnd
                }
            }
        });

        // Send email to the executive
        await sendVisitNotificationToExecutive(
            visit.executive.user.email,
            visit.executive.name,
            visit.store.storeName,
            todayVisitCount
        );

        console.log(`✅ Visit notification sent for visit ${visitId}`);
    } catch (error) {
        console.error('Error sending visit notification:', error);
    }
}

/**
 * Example: Send daily summary to admins at end of day
 * Groups by EXECUTIVE only - each executive gets ONE row with all stores comma-separated
 * This should be called via a cron job or scheduled task
 */
export async function sendDailySummaryToAdmins() {
    try {
        // Get today's start and end time
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Fetch all visits for today with executive and store details
        const todayVisits = await prisma.visit.findMany({
            where: {
                createdAt: {
                    gte: todayStart,
                    lte: todayEnd
                }
            },
            include: {
                executive: true,
                store: true
            }
        });

        // Group visits by EXECUTIVE only (not by store)
        // Each executive gets ONE row with all stores comma-separated
        const executiveMap = new Map<string, {
            executiveName: string;
            stores: Set<string>;
            visitCount: number;
        }>();

        todayVisits.forEach(visit => {
            if (executiveMap.has(visit.executiveId)) {
                // Add store to existing executive's store list
                const existing = executiveMap.get(visit.executiveId)!;
                existing.stores.add(visit.store.storeName);
                existing.visitCount += 1;
            } else {
                // Create new entry for this executive
                executiveMap.set(visit.executiveId, {
                    executiveName: visit.executive.name,
                    stores: new Set([visit.store.storeName]),
                    visitCount: 1
                });
            }
        });

        // Convert to format expected by email function
        // storeName will contain comma-separated list of all stores
        const visitData = Array.from(executiveMap.values()).map(exec => ({
            executiveName: exec.executiveName,
            storeName: Array.from(exec.stores).join(', '), // All stores comma-separated
            visitCount: exec.visitCount // Total visits across all stores
        }));

        if (visitData.length === 0) {
            console.log('No visits today, skipping admin email');
            return;
        }

        // Send email to admins
        await sendDailyVisitSummaryToAdmins(visitData);

        console.log(`✅ Daily summary sent to admins with ${visitData.length} executives`);
    } catch (error) {
        console.error('Error sending daily summary:', error);
    }
}

