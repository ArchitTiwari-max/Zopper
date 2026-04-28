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

    // Logic for PJP (Visit Plan) created before 12 PM IST
    const now = new Date();
    // Convert current time to IST to find out what "today" is in India
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const todayStr = istNow.toISOString().split('T')[0]; // e.g., "2026-04-24"
    
    // In the DB, visitDate is stored as "YYYY-MM-DDT00:00:00.000Z"
    const todayVisitDateStart = new Date(todayStr + 'T00:00:00.000Z');
    const tomorrowVisitDateStart = new Date(todayVisitDateStart);
    tomorrowVisitDateStart.setDate(tomorrowVisitDateStart.getDate() + 1);
    
    // 12:00 PM IST is 06:30 AM UTC on the same day
    const utcToday12Noon = new Date(todayVisitDateStart.getTime() + 6.5 * 60 * 60 * 1000);

    console.log(`📅 Current Time (UTC): ${now.toISOString()}`);
    console.log(`📅 Today (IST): ${todayStr}`);
    console.log(`📅 Querying visits with visitDate: ${todayVisitDateStart.toISOString()}`);
    console.log(`📅 PJP Cutoff (IST 12 PM): ${utcToday12Noon.toISOString()}`);

    // Fetch all visits for today (only from active executives)
    const visits = await prisma.visit.findMany({
      where: {
        visitDate: {
          gte: todayVisitDateStart,
          lt: tomorrowVisitDateStart,
        },
        executive: {
          user: {
            isActive: true,
          },
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

    // Fetch PJPs for today submitted before 12 PM IST
    const visitPlans = await prisma.visitPlan.findMany({
      where: {
        plannedVisitDate: {
          gte: todayVisitDateStart,
          lt: tomorrowVisitDateStart,
        },
        submittedAt: {
          lte: utcToday12Noon,
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    // Fetch all brands mentioned in today's visits
    const allBrandIds = [...new Set(visits.flatMap(v => v.brandIds || []))];
    const brands = await prisma.brand.findMany({
      where: { id: { in: allBrandIds } },
      select: { id: true, brandName: true }
    });
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    console.log(`🔍 Found ${visits.length} visits, ${visitPlans.length} PJPs and ${brands.length} unique brands`);

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

    // Group visits and PJPs by executive
    const executiveVisits = new Map();
    
    // Initialize all executives with 0 visits and empty PJP
    allExecutives.forEach((exec) => {
      executiveVisits.set(exec.id, {
        executiveId: exec.id,
        executiveName: exec.name,
        executiveEmail: exec.user.email,
        stores: [],
        visitCount: 0,
        pjpStores: [],
        pjpReason: '',
        actualStoreIds: new Set(),
      });
    });

    // Add today's visits to the map
    visits.forEach((visit) => {
      const executiveId = visit.executiveId;
      
      if (executiveVisits.has(executiveId)) {
        const data = executiveVisits.get(executiveId);
        
        // Format brand names
        const visitBrands = (visit.brandIds || [])
          .map(id => brandMap.get(id))
          .filter(Boolean)
          .join(', ');
          
        const displayString = visitBrands 
          ? `${visit.store.storeName} - ${visitBrands}`
          : visit.store.storeName;

        data.stores.push(displayString);
        data.actualStoreIds.add(visit.storeId);
        data.visitCount += 1;
      }
    });

    // Add PJP stores to the map (latest one per executive)
    const seenExecs = new Set();
    visitPlans.forEach((plan) => {
      if (!seenExecs.has(plan.executiveId)) {
        seenExecs.add(plan.executiveId);
        const data = executiveVisits.get(plan.executiveId);
        if (data && plan.storesSnapshot) {
          const snapshot = plan.storesSnapshot as any[];
          data.pjpStores = snapshot.map(s => s.storeName);
          
          // Calculate if there's STILL a mismatch at the time this email is generated
          const plannedStoreIds = new Set(plan.storeIds);
          const actualStoreIds = data.actualStoreIds;
          
          let hasDeviation = false;
          if (plannedStoreIds.size !== actualStoreIds.size) {
            hasDeviation = true;
          } else {
            for (const id of plannedStoreIds) {
              if (!actualStoreIds.has(id)) {
                hasDeviation = true;
                break;
              }
            }
          }

          // Only show the reason if there is currently a mismatch
          if (hasDeviation) {
            data.pjpReason = plan.pjpNotFollowedReason || 'Reason not provided';
            data.hasDeviation = true;
          } else {
            data.pjpReason = ''; // Resolved or no mismatch
            data.hasDeviation = false;
          }
        }
      }
    });

    // Send to each executive
    for (const [, executiveData] of executiveVisits) {
      await sendVisitNotificationToExecutive(
        executiveData.executiveEmail,
        executiveData.executiveName,
        executiveData.stores.join('|||'),
        executiveData.visitCount,
        executiveData.pjpStores.join('|||')
      );
    }

    // Send admin summary
    const summaryData = Array.from(executiveVisits.values())
      .map((data) => ({
        executiveId: data.executiveId,
        executiveName: data.executiveName,
        storeName: data.stores.join('|||'),
        visitCount: data.visitCount,
        pjpStoreNames: data.pjpStores.join('|||'),
        pjpReason: data.pjpReason,
        hasDeviation: data.hasDeviation,
      }))
      .sort((a, b) => b.visitCount - a.visitCount); // Sort by visitCount descending

    await sendDailyVisitSummaryToAdmins(summaryData);

    return Response.json({ 
      success: true, 
      executivesNotified: executiveVisits.size,
      totalVisits: visits.length,
      totalPJPs: visitPlans.length
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: String(error), success: false }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

//curl -X GET "http://localhost:3000/api/cron/send-daily-emails"
