import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const executives = await prisma.executive.findMany({
    select: {
      id: true,
      name: true,
      region: true,
      managerIds: true,
      subordinateIds: true
    }
  });

  console.log("=== ALL EXECUTIVES ===");
  for (const e of executives) {
    console.log(`ID: ${e.id}, Name: ${e.name}, Region: ${e.region}, Managers: ${JSON.stringify(e.managerIds)}, Subordinates: ${JSON.stringify(e.subordinateIds)}`);
  }
}

main().finally(() => prisma.$disconnect());
