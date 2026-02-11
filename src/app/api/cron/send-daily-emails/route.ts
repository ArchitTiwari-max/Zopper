import { sendDailyVisitSummaryToAdmins, sendVisitNotificationToExecutive } from '@/querryRunner/user/emailsender/mailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    // Skip if today is Sunday (0 = Sunday)
    if (new Date().getDay() === 0) {
      console.log('📅 Sunday - skipping');
      return Response.json({ success: true, message: 'Skipped - Sunday' });
    }

    // Get today's date range (00:00:00 to 23:59:59)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`📅 Fetching visits for ${today.toDateString()}`);

    // Fetch all visits for today
    const visits = await prisma.visit.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        executive: {
          include: {
            user: true,
          },
        },
        store: true,
      },
    });

    console.log(`� Found ${visits.length} visits`);

    // Fetch all active executives
    const allExecutives = await prisma.executive.findMany({
      include: {
        user: true,
      },
      where: {
        user: {
          isActive: true,
        },
      },
    });

    console.log(`👥 Total executives: ${allExecutives.length}`);

    // Group visits by executive
    const executiveVisits = new Map();
    
    // Initialize all executives with 0 visits
    allExecutives.forEach((exec) => {
      executiveVisits.set(exec.id, {
        executiveId: exec.id,
        executiveName: exec.name,
        executiveEmail: exec.user.email,
        stores: [],
        visitCount: 0,
      });
    });

    // Add today's visits to the map
    visits.forEach((visit) => {
      const executiveId = visit.executiveId;
      
      if (executiveVisits.has(executiveId)) {
        const data = executiveVisits.get(executiveId);
        data.stores.push(visit.store.storeName);
        data.visitCount += 1;
      }
    });

    // Send to each executive
    for (const [, executiveData] of executiveVisits) {
      await sendVisitNotificationToExecutive(
        executiveData.executiveEmail,
        executiveData.executiveName,
        executiveData.stores.join(', '),
        executiveData.visitCount
      );
    }

    // Send admin summary
    const summaryData = Array.from(executiveVisits.values())
      .map((data) => ({
        executiveId: data.executiveId,
        executiveName: data.executiveName,
        storeName: data.stores.join(', '),
        visitCount: data.visitCount,
      }))
      .sort((a, b) => b.visitCount - a.visitCount); // Sort by visitCount descending

    await sendDailyVisitSummaryToAdmins(summaryData);

    return Response.json({ 
      success: true, 
      executivesNotified: executiveVisits.size,
      totalVisits: visits.length
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: String(error), success: false }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
