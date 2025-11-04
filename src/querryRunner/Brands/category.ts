import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  // Read Excel file
  const workbook = XLSX.readFile('src/querryRunner/Brands/brands.xlsx');
  const sheetName = workbook.SheetNames[1]; // Sheet 2 (Zero-based index)
  const worksheet = workbook.Sheets[sheetName];

  // Parse worksheet to JSON
  const data: { Category_id: string; categoryName: string; brandIds: string }[] = XLSX.utils.sheet_to_json(worksheet);

  for (const category of data) {
    try {
      // Create or update the Category
      await prisma.category.upsert({
        where: { id: category.Category_id },
        update: { categoryName: category.categoryName },
        create: {
          id: category.Category_id,
          categoryName: category.categoryName,
        },
      });

      // Create CategoryBrand relations
      const brandIdsArray = category.brandIds.split(',');

      for (const brandId of brandIdsArray) {
        await prisma.categoryBrand.upsert({
          where: {
            brandId_categoryId: {
              brandId: brandId.trim(),
              categoryId: category.Category_id,
            },
          },
          update: {},
          create: {
            id: `${brandId.trim()}_${category.Category_id}`,
            brandId: brandId.trim(),
            categoryId: category.Category_id,
          },
        });
      }
      console.log(`✅ Successfully processed category ${category.Category_id} - ${category.categoryName}`);
    } catch (error) {
      console.error(`❌ Failed to process category ${category.Category_id} - ${category.categoryName}`, error);
    }
  }
}

main()
  .catch((e) => {
    console.error('Unexpected error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
