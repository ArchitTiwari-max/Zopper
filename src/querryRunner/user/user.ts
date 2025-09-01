import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

async function main() {
  // Load Excel file
  const workbook = XLSX.readFile("src/querryRunner/user/users.xlsx");
  const sheetName = workbook.SheetNames[0];
  const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  for (const row of data) {
    const newExecutive = await prisma.user.create({
      data: {
        email: row.email,
        username: row.username,
        password: row["password"], // already hashed in Excel
        role: row.role,
        executive: {
          create: {
            name: row.name,
            region: row.region,
            assignedStoreIds: row.assignedStoreIds
              ? row.assignedStoreIds.split(",").map((id: string) => id.trim())
              : [],
          },
        },
      },
      include: {
        executive: true,
      },
    });

    console.log(`✅ Inserted user + executive: ${newExecutive.username}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error seeding:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
