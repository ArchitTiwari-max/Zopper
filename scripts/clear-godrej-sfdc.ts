import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const beforeCount = await prisma.godrejSfdc.count();
    console.log(`Existing GodrejSfdc records: ${beforeCount}`);

    const result = await prisma.godrejSfdc.deleteMany({});
    console.log(`Deleted GodrejSfdc records: ${result.count}`);

    const afterCount = await prisma.godrejSfdc.count();
    console.log(`Remaining GodrejSfdc records: ${afterCount}`);
  } catch (error) {
    console.error("Error clearing GodrejSfdc records:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();




