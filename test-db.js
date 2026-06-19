const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    console.log("DB connection successful. User found:", user ? user.username : "None");
  } catch (e) {
    console.error("DB connection error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
