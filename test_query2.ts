import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.executive.findUnique({
    where: { id: 'executive_00018' },
    select: {
      id: true,
      managerIds: true,
      managers: { select: { id: true } }
    }
  });
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
