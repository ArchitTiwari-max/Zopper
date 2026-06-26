import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vinodId = 'executive_00014';
  
  const executive = await prisma.executive.findUnique({
    where: { id: vinodId },
    include: { user: true }
  });

  if (!executive) {
    console.log("Vinod not found!");
    return;
  }

  console.log(`Found Executive: ${executive.id}, Email: ${executive.user.email}`);

  // Fetch visit plans
  const plans = await prisma.visitPlan.findMany({
    where: { executiveId: vinodId },
    orderBy: { plannedVisitDate: 'desc' },
    take: 10
  });

  console.log("\nRecent Visit Plans for Vinod:");
  for (const plan of plans) {
    const planDate = new Date(plan.plannedVisitDate);
    // Find visits on that day
    const startOfPlanDay = new Date(Date.UTC(planDate.getUTCFullYear(), planDate.getUTCMonth(), planDate.getUTCDate(), -5, -30, 0, 0));
    const endOfPlanDay = new Date(startOfPlanDay.getTime() + 24 * 60 * 60 * 1000);

    const planVisits = await prisma.visit.findMany({
      where: {
        executiveId: vinodId,
        createdAt: {
          gte: startOfPlanDay,
          lt: endOfPlanDay
        }
      },
      select: { storeId: true }
    });

    const plannedStoreIds = new Set(plan.storeIds);
    const actualStoreIds = new Set(planVisits.map(v => v.storeId));

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

    console.log(`Date: ${plan.plannedVisitDate.toISOString().slice(0, 10)}, ID: ${plan.id}`);
    console.log(`  Submitted At: ${plan.submittedAt.toISOString()}`);
    console.log(`  Planned Stores: ${Array.from(plannedStoreIds).join(', ')}`);
    console.log(`  Actual Stores Visited: ${Array.from(actualStoreIds).join(', ')}`);
    console.log(`  Has Deviation: ${hasDeviation}`);
    console.log(`  pjpNotFollowedReason: "${plan.pjpNotFollowedReason ?? 'NULL'}"`);
  }
}

main().finally(() => prisma.$disconnect());
