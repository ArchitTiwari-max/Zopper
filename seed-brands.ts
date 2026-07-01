import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany();
  const brandIds = brands.map(b => b.id);
  
  if (brandIds.length > 0) {
    await prisma.stakeholder.updateMany({
      data: {
        brands: brandIds
      }
    });
    console.log(`Updated stakeholders to include all ${brandIds.length} brands`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
