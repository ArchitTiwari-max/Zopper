import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendDailyPJPSummaryToAdmins, sendPJPNotificationToExecutive } from '@/querryRunner/user/emailsender/mailer';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Logic for PJP (Visit Plan) created before 12 PM IST
    const now = new Date();
    // Convert current time to IST
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const todayStr = istNow.toISOString().split('T')[0]; 
    
    // Skip if today is Sunday (0 = Sunday) in IST
    if (istNow.getUTCDay() === 0) {
        console.log('📅 Sunday - skipping PJP summary');
        return NextResponse.json({ success: true, message: 'Skipped - Sunday' });
    }
    
    // In the DB, visitDate is stored as "YYYY-MM-DDT00:00:00.000Z"
    const todayVisitDateStart = new Date(todayStr + 'T00:00:00.000Z');
    const tomorrowVisitDateStart = new Date(todayVisitDateStart);
    tomorrowVisitDateStart.setDate(tomorrowVisitDateStart.getDate() + 1);
    
    // 12:00 PM IST cutoff
    const utcToday12Noon = new Date(todayVisitDateStart.getTime() + 6.5 * 60 * 60 * 1000);

    // Fetch PJPs for today submitted before 12 PM IST
    const visitPlans = await prisma.visitPlan.findMany({
      where: {
        plannedVisitDate: {
          gte: todayVisitDateStart,
          lt: tomorrowVisitDateStart,
        },
        submittedAt: {
          lte: utcToday12Noon,
        },
        executive: {
            user: {
                isActive: true
            }
        }
      },
      include: {
        executive: true
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    // Fetch all active executives to send individual PJP mails
    const activeExecutives = await prisma.executive.findMany({
      where: {
        user: {
          isActive: true
        }
      },
      include: {
        user: true
      }
    });

    // Map plans by executive (take only the latest)
    const pjpMap = new Map<string, { executiveName: string; pjpStoreNames: string }>();
    const seenExecs = new Set<string>();

    visitPlans.forEach((plan) => {
      if (!seenExecs.has(plan.executiveId)) {
        seenExecs.add(plan.executiveId);
        
        let storeNames = '';
        if (plan.leaveReason) {
          storeNames = `[On Leave / Alignment] ${plan.leaveReason}`;
        } else {
          const snapshot = plan.storesSnapshot as any[] || [];
          storeNames = snapshot.map(s => s.storeName).join('|||');
        }
        
        pjpMap.set(plan.executiveId, {
          executiveName: plan.executive?.name || 'Unknown Executive',
          pjpStoreNames: storeNames
        });
      }
    });

    // Send individual PJP mails to all active executives
    for (const executive of activeExecutives) {
        const executivePlan = pjpMap.get(executive.id);
        await sendPJPNotificationToExecutive(
            executive.user.email,
            executive.name,
            executivePlan ? executivePlan.pjpStoreNames : ''
        );
    }

    // Convert map to array for the mailer - include ALL active executives
    const pjpData = activeExecutives.map((executive) => {
      const plan = pjpMap.get(executive.id);
      return {
        executiveName: executive.name,
        pjpStoreNames: plan ? plan.pjpStoreNames : ''
      };
    }).sort((a, b) => a.executiveName.localeCompare(b.executiveName));

    // if (pjpData.length > 0) {
      await sendDailyPJPSummaryToAdmins(pjpData);
    // }

    return NextResponse.json({
      success: true,
      totalPJPs: pjpData.length,
      message: pjpData.length > 0 ? 'Daily PJP summary sent' : 'No PJPs found to send'
    });

  } catch (error) {
    console.error('Error sending daily PJP summary:', error);
    return NextResponse.json({ error: 'Failed to send daily PJP summary' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
