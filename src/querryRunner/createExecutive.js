import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create executive user + executive record
  const newExecutive = await prisma.user.create({
    data: {
      email: "executive1@example.com",
      username: "executive1",
      password: "hashedpassword123", // ⚠️ hash in real app
      role: "EXECUTIVE",
      executive: {
        create: {
          region: "North Zone",
          assignedBrandIds: [],
          assignedStoreIds: []
        }
      }
    },
    include: {
      executive: true
    }
  });

  console.log("Executive User Created:", newExecutive);
}

main()
  .catch((e) => {
    console.error("Error:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });