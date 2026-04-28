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
    
    // Initialize all executives
    allExecutives.forEach((exec) => {
      executiveVisits.set(exec.id, {
        executiveId: exec.id,
        executiveName: exec.name,
        executiveEmail: exec.user.email,
        actualVisits: [] as { storeId: string, displayString: string }[],
        visitCount: 0,
        plannedVisits: [] as { storeId: string, displayString: string }[],
        pjpReason: '',
        hasDeviation: false,
        hasPjp: false
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

        data.actualVisits.push({ storeId: visit.storeId, displayString });
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
          data.hasPjp = true;
          const snapshot = plan.storesSnapshot as any[];
          data.plannedVisits = snapshot.map(s => ({ storeId: s.id, displayString: s.storeName }));
          
          // Calculate deviation
          const plannedStoreIds = new Set(plan.storeIds);
          const actualStoreIds = new Set(data.actualVisits.map((v: any) => v.storeId));
          
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

          if (hasDeviation) {
            data.pjpReason = plan.pjpNotFollowedReason || 'Reason not provided';
            data.hasDeviation = true;
          } else {
            data.pjpReason = ''; 
            data.hasDeviation = false;
          }
        }
      }
    });

    // Build categorized HTML lists
    const summaryData = [];

    for (const [, exec] of executiveVisits) {
      const actualStoreIds = new Set(exec.actualVisits.map((v: any) => v.storeId));
      const plannedStoreIds = new Set(exec.plannedVisits.map((v: any) => v.storeId));

      const followedActual = exec.actualVisits.filter((v: any) => plannedStoreIds.has(v.storeId));
      const unplannedActual = exec.actualVisits.filter((v: any) => !plannedStoreIds.has(v.storeId));

      const followedPlanned = exec.plannedVisits.filter((v: any) => actualStoreIds.has(v.storeId));
      const missedPlanned = exec.plannedVisits.filter((v: any) => !actualStoreIds.has(v.storeId));

      // Build Actual Visits HTML
      let visitsHtml = '';
      if (exec.actualVisits.length > 0) {
        if (exec.hasPjp) {
          if (followedActual.length > 0) {
            visitsHtml += `<div style="margin-top: 5px; font-weight: bold; color: #10b981; font-size: 13px;">✅ Followed (${followedActual.length})</div>`;
            visitsHtml += `<ul style="margin: 4px 0 10px 0; padding-left: 20px;">`;
            followedActual.forEach((v: any) => visitsHtml += `<li style="margin: 2px 0;">${v.displayString}</li>`);
            visitsHtml += `</ul>`;
          }
          if (unplannedActual.length > 0) {
            visitsHtml += `<div style="margin-top: 5px; font-weight: bold; color: #f59e0b; font-size: 13px;">⚠️ Unplanned (${unplannedActual.length})</div>`;
            visitsHtml += `<ul style="margin: 4px 0 10px 0; padding-left: 20px;">`;
            unplannedActual.forEach((v: any) => visitsHtml += `<li style="margin: 2px 0;">${v.displayString}</li>`);
            visitsHtml += `</ul>`;
          }
        } else {
          visitsHtml += `<div style="margin-top: 5px; font-weight: bold; color: #f59e0b; font-size: 13px;">⚠️ Unplanned (${exec.actualVisits.length})</div>`;
          visitsHtml += `<ul style="margin: 4px 0 10px 0; padding-left: 20px;">`;
          exec.actualVisits.forEach((v: any) => visitsHtml += `<li style="margin: 2px 0;">${v.displayString}</li>`);
          visitsHtml += `</ul>`;
        }
      }

      // Build PJP HTML
      let pjpHtml = '';
      if (exec.hasPjp) {
        if (followedPlanned.length > 0) {
          pjpHtml += `<div style="margin-top: 5px; font-weight: bold; color: #10b981; font-size: 13px;">✅ Followed (${followedPlanned.length})</div>`;
          pjpHtml += `<ul style="margin: 4px 0 10px 0; padding-left: 20px;">`;
          followedPlanned.forEach((v: any) => pjpHtml += `<li style="margin: 2px 0;">${v.displayString}</li>`);
          pjpHtml += `</ul>`;
        }
        if (missedPlanned.length > 0) {
          pjpHtml += `<div style="margin-top: 5px; font-weight: bold; color: #ef4444; font-size: 13px;">❌ Missed (${missedPlanned.length})</div>`;
          pjpHtml += `<ul style="margin: 4px 0 10px 0; padding-left: 20px;">`;
          missedPlanned.forEach((v: any) => pjpHtml += `<li style="margin: 2px 0;">${v.displayString}</li>`);
          pjpHtml += `</ul>`;
        }
      }

      summaryData.push({
        executiveId: exec.executiveId,
        executiveName: exec.executiveName,
        visitCount: exec.visitCount,
        hasPjp: exec.hasPjp,
        visitsHtml,
        pjpStoresHtml: pjpHtml,
        pjpReason: exec.pjpReason,
        hasDeviation: exec.hasDeviation,
      });

      // Send to each executive
      await sendVisitNotificationToExecutive(
        exec.executiveEmail,
        exec.executiveName,
        visitsHtml,
        exec.visitCount,
        pjpHtml
      );
    }

    // Send admin summary
    summaryData.sort((a, b) => b.visitCount - a.visitCount); // Sort by visitCount descending
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
