import { prisma } from '../../lib/prisma';
import * as XLSX from "xlsx";


async function main(): Promise<void> {
  // 1. Read Excel file
  const workbook = XLSX.readFile("src/querryRunner/Brands/brands.xlsx");
  const sheetName = workbook.SheetNames[0]; // first sheet
  const sheet = workbook.Sheets[sheetName];

  // 2. Convert sheet → JSON
  const brands: any[] = XLSX.utils.sheet_to_json(sheet);

  // 3. Insert into MongoDB with Prisma
  for (const brand of brands) {
    await prisma.brand.create({
      data: {
        id: brand.Brand_id,
        brandName: brand.brandName,
        // category field removed - now using CategoryBrand relationship
      },
    });
    console.log(`Inserted brand: ${brand.brandName}`);
  } 
   console.log("Brands imported successfully!");
}

// Run main()
main()
  .catch((e) => {
    console.error("❌ Error importing brands:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
