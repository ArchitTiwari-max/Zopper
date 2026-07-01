import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dummyDesignations = [
    'Zonal Sales Manager',
    'Regional Manager',
    'Area Sales Manager',
    'Service Head',
  ];

  // We leave brands array empty so they apply to all brands for now,
  // or we can just let them apply to all.
  for (const des of dummyDesignations) {
    const existing = await prisma.stakeholder.findFirst({
      where: { designation: des }
    });
    
    if (!existing) {
      await prisma.stakeholder.create({
        data: {
          id: (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)),
          designation: des,
          brands: [], // empty means it applies to all in our current frontend logic
          isActive: true
        }
      });
      console.log(`Created dummy designation: ${des}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
