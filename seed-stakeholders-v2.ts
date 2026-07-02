import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany({ select: { id: true } });
  const brandIds = brands.map(b => b.id);
  
  if (brandIds.length === 0) {
    console.log("No brands found to link stakeholders to. Please create brands first.");
    return;
  }

  const dummyDesignations = [
    "Regional Sales Manager (RSM)",
    "Zonal Sales Manager (ZSM)",
    "Distributor",
    "Area Sales Manager (ASM)"
  ];

  for (const des of dummyDesignations) {
    await prisma.stakeholder.create({
      data: {
        id: uuidv4(),
        designation: des,
        brands: brandIds, // Link to all brands for testing
        isActive: true
      }
    });
  }

  console.log(`Successfully created ${dummyDesignations.length} dummy stakeholders linked to all brands.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
