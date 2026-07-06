import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany({ select: { id: true, brandName: true } });
  
  const getBrandId = (name: string) => {
    const brand = brands.find(b => b.brandName.toLowerCase() === name.toLowerCase());
    return brand ? brand.id : null;
  };

  const mappings: { brand: string, designations: string[] }[] = [
    { brand: 'Godrej', designations: ['ASM', 'BH', 'RH'] },
    { brand: 'Hitachi', designations: ['ASI', 'ASM', 'BSH', 'RSM'] },
    { brand: 'Samsung', designations: ['ASE', 'ZSE/ABM', 'ZSM'] },
    { brand: 'Havells', designations: ['SM', 'BH'] },
    { brand: 'Haier', designations: ['TL', 'BME'] },
    { brand: 'Nothing', designations: ['TL', 'ASM', 'State Head'] },
    { brand: 'Xiaomi', designations: ['TL', 'CSM', 'ZSM', 'ZH'] },
    { brand: 'DSDSG', designations: ['Regional Sales Manager (RSM)', 'Zonal Sales Manager (ZSM)', 'Distributor', 'Area Sales Manager (ASM)'] }
  ];

  // Map designation to array of brand IDs
  const designationToBrands = new Map<string, string[]>();

  for (const m of mappings) {
    const bId = getBrandId(m.brand);
    if (!bId) {
      console.log(`Warning: Brand '${m.brand}' not found in DB.`);
      continue;
    }
    
    for (const des of m.designations) {
      if (!designationToBrands.has(des)) {
        designationToBrands.set(des, []);
      }
      designationToBrands.get(des)!.push(bId);
    }
  }

  // Clear existing stakeholders
  const deleteRes = await prisma.stakeholder.deleteMany();
  console.log(`Deleted ${deleteRes.count} old stakeholders.`);

  // Create new stakeholders
  for (const [des, brandIds] of designationToBrands.entries()) {
    await prisma.stakeholder.create({
      data: {
        id: uuidv4(),
        designation: des,
        brands: brandIds,
        isActive: true
      }
    });
    console.log(`Created designation: '${des}' mapped to ${brandIds.length} brands.`);
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
