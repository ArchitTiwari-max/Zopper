import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.executive.findUnique({
    where: { id: 'executive_00005' },
    select: {
      managerIds: true,
      subordinateIds: true,
      subordinates: { select: { id: true } }
    }
  });
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
