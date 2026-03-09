import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const filters = { dateFilter: 'Last 30 Days' };
    const now = new Date();
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    console.log("Fetching visits...");
    const [visits, brands] = await Promise.all([
      prisma.adminVisit.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: {
          id: true, remarks: true, brandIds: true, createdAt: true,
          POSMchecked: true, personMet: true, imageUrls: true,
          admin: { select: { id: true, name: true } },
          store: { select: { id: true, storeName: true, city: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.brand.findMany({ select: { id: true, brandName: true } })
    ]);

    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    const processedVisits = visits.map((visit) => {
      const partnerBrands = (visit.brandIds || []).map(brandId => brandMap.get(brandId)).filter(Boolean);
      const execName = visit.admin?.name || 'Unknown Admin';
      const colors = ['#E53E3E'];
      const colorIndex = execName.charAt(0).toUpperCase().charCodeAt(0) - 65;
      const safeColorIndex = Math.max(0, Math.min(colorIndex, colors.length - 1));

      let peopleMet: any[] = [];
      if (visit.personMet && Array.isArray(visit.personMet)) {
        peopleMet = (visit.personMet as any[]).map(p => ({ name: p?.name }));
      }

      return {
        id: visit.id,
        executiveName: execName,
        storeName: visit.store?.storeName || 'Unknown Store'
      };
    });

    console.log("Success! Processed", processedVisits.length, "visits.");
  } catch (e) {
    console.error("Error running test-data:", e);
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error);
