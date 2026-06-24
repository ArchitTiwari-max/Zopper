import { PrismaClient, PlanType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring N/A ProductSubCategory exists...');
  const naSubcat = await prisma.productSubCategory.upsert({
    where: { name: 'N/A' },
    update: {},
    create: {
      id: 'subcat_na',
      name: 'N/A'
    }
  });

  console.log('Migrating SalesRecord documents...');
  
  const records = await prisma.salesRecord.findMany({
    where: {
      OR: [
        { modelName: null },
        { productSubCategoryId: null },
        { planType: null }
      ]
    }
  });

  console.log(`Found ${records.length} records to migrate.`);

  let updatedCount = 0;
  for (const record of records) {
    await prisma.salesRecord.update({
      where: { id: record.id },
      data: {
        modelName: record.modelName || 'N/A',
        productSubCategoryId: record.productSubCategoryId || naSubcat.id,
        planType: record.planType || PlanType.NA,
      }
    });
    updatedCount++;
    if (updatedCount % 50 === 0) {
      console.log(`Updated ${updatedCount} records...`);
    }
  }

  console.log(`Migration completed successfully. Updated ${updatedCount} records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
