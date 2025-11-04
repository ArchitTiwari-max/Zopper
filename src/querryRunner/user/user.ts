import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

async function main() {
  // Load Excel file
  const workbook = XLSX.readFile("src/querryRunner/user/users.xlsx");
  const sheetName = workbook.SheetNames[0];
  const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  for (const row of data) {
    try {
      let newUser;

      if (row.role?.toUpperCase() === "EXECUTIVE") {
        // ✅ Create User + Executive
        newUser = await prisma.user.create({
          data: {
            id: row.User_id, // use custom id from Excel
            email: row.email,
            username: row.username,
            password: row.password, // assuming already hashed
            role: "EXECUTIVE",
            executive: {
              create: {
                id: row.Executive_id,
                name: row.name,
                contact_number:String(row.contact_number || ""),
                region: row.region
              },
            },
          },
          include: {
            executive: true,
          },
        });

        console.log(`✅ Inserted Executive user: ${newUser.username}`);
      } else if (row.role?.toUpperCase() === "ADMIN") {
        // ✅ Create User + Admin
        newUser = await prisma.user.create({
          data: {
            id: row.User_id,
            email: row.email,
            username: row.username,
            password: row.password,
            role: "ADMIN",
            admin: {
              create: {
                id: row.Admin_id,
                name: row.name,
                contact_number: String(row.contact_number || ""),
                region: row.region,
              },
            },
          },
          include: {
            admin: true,
          },
        });

        console.log(`✅ Inserted Admin user: ${newUser.username}`);
      } else {
        console.warn(`⚠️ Skipped row with unknown role: ${row.role}`);
      }
    } catch (err) {
      console.error(`❌ Failed to insert row for username: ${row.username}`);
    }
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
