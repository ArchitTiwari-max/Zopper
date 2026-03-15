import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const storeId = 'store_000280'
  const [execVisitsRaw, adminVisitsRaw] = await Promise.all([
      prisma.visit.findMany({
        where: { storeId: storeId },
        include: { store: true, executive: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.adminVisit.findMany({
        where: { storeId: storeId },
        include: { store: true, admin: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

  const allVisits = [
      ...execVisitsRaw.map(v => ({ ...v, submitterType: 'EXECUTIVE' as const })),
      ...adminVisitsRaw.map(v => ({ ...v, submitterType: 'ADMIN' as const }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

  console.log("EXEC:", execVisitsRaw.length, "ADMIN:", adminVisitsRaw.length);
  console.log("Combined:", allVisits.length);
}
main().finally(() => prisma.$disconnect())
