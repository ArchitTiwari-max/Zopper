import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const alignment = await prisma.storeAlignment.findFirst({
    where: {
      storeLevel: { not: undefined }
    } // find any with data
  });

  if (alignment) {
    console.log("Store Level:", JSON.stringify(alignment.storeLevel, null, 2));
    console.log("Stakeholder Level:", JSON.stringify(alignment.stakeholderLevel, null, 2));
  } else {
    console.log("No alignment data found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
