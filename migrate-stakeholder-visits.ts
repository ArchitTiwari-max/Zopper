import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const visits = await prisma.stakeholderVisit.findMany();
  console.log(`Found ${visits.length} total visits.`);

  for (const visit of visits) {
    if (visit.brandName && !visit.brandId) {
      // Look up brand by name
      const brand = await prisma.brand.findUnique({
        where: { brandName: visit.brandName }
      });
      
      if (brand) {
        await prisma.stakeholderVisit.update({
          where: { id: visit.id },
          data: { brandId: brand.id }
        });
        console.log(`Updated visit ${visit.id}: brandName '${visit.brandName}' -> brandId '${brand.id}'`);
      } else {
        console.log(`Warning: Brand '${visit.brandName}' not found for visit ${visit.id}`);
      }
    } else {
      console.log(`Skipping visit ${visit.id}: already has brandId or missing brandName`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
