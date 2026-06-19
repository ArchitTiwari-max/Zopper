import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const execs = await prisma.executive.findMany({
    select: { id: true, name: true }
  });
  console.log(`Found ${execs.length} executives.`);
  for (const e of execs) {
    console.log(`- ${e.id}: ${e.name}`);
  }
}

main().finally(() => prisma.$disconnect());
