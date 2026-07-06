import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const dsdsgBrand = await prisma.brand.findFirst({
    where: { brandName: { equals: 'DSDSG', mode: 'insensitive' } }
  });

  if (!dsdsgBrand) {
    console.log("DSDSG brand not found.");
    return;
  }

  const dsdsgId = dsdsgBrand.id;
  console.log(`Found DSDSG brand with ID: ${dsdsgId}`);

  // 1. Find all stakeholders currently having DSDSG brand
  const currentStakeholders = await prisma.stakeholder.findMany({
    where: { brands: { has: dsdsgId } }
  });

  console.log(`Removing DSDSG from ${currentStakeholders.length} existing stakeholders.`);

  // 2. Remove DSDSG from their brands array
  for (const st of currentStakeholders) {
    const newBrands = st.brands.filter(b => b !== dsdsgId);
    
    if (newBrands.length === 0) {
      // If it was only for DSDSG (like the dummy ones), delete it
      await prisma.stakeholder.delete({ where: { id: st.id } });
      console.log(`Deleted dummy stakeholder: ${st.designation}`);
    } else {
      // Otherwise just remove DSDSG from the array
      await prisma.stakeholder.update({
        where: { id: st.id },
        data: { brands: newBrands }
      });
      console.log(`Removed DSDSG from stakeholder: ${st.designation}`);
    }
  }

  // 3. Add 'DM' and 'SM' for DSDSG
  const newDesignations = ['DM', 'SM'];

  for (const des of newDesignations) {
    // Check if designation already exists globally
    let existing = await prisma.stakeholder.findFirst({
      where: { designation: des }
    });

    if (existing) {
      // Append DSDSG to it
      await prisma.stakeholder.update({
        where: { id: existing.id },
        data: { brands: { push: dsdsgId } }
      });
      console.log(`Appended DSDSG to existing stakeholder: ${des}`);
    } else {
      // Create new one
      await prisma.stakeholder.create({
        data: {
          id: uuidv4(),
          designation: des,
          brands: [dsdsgId],
          isActive: true
        }
      });
      console.log(`Created new stakeholder: ${des} for DSDSG`);
    }
  }

  console.log("DSDSG Stakeholders updated successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
