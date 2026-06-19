import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const subCategories = [
  { id: "subcat_001", name: "Low" },
  { id: "subcat_002", name: "Mid" },
  { id: "subcat_003", name: "High" },
  { id: "subcat_004", name: "Premium" },
  { id: "subcat_005", name: "Super Premium" },
  { id: "subcat_006", name: "Luxury Fold" },
  { id: "subcat_007", name: "Luxury Flip" }
];

async function main() {
  console.log("🌱 Seeding product subcategories with custom IDs...");
  
  for (const item of subCategories) {
    try {
      const existing = await prisma.productSubCategory.findUnique({
        where: { name: item.name }
      });
      
      if (existing) {
        if (existing.id !== item.id) {
          // If the ID is different, delete and recreate to change the immutable _id
          await prisma.productSubCategory.delete({ where: { name: item.name } });
          const created = await prisma.productSubCategory.create({
            data: { id: item.id, name: item.name }
          });
          console.log(`🔄 Recreated subcategory: "${created.name}" with ID: ${created.id}`);
        } else {
          console.log(`ℹ️ Subcategory "${existing.name}" already has correct ID: ${existing.id}`);
        }
      } else {
        const created = await prisma.productSubCategory.create({
          data: { id: item.id, name: item.name }
        });
        console.log(`✅ Created subcategory: "${created.name}" (ID: ${created.id})`);
      }
    } catch (error) {
      console.error(`❌ Failed to seed subcategory "${item.name}":`, error);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
