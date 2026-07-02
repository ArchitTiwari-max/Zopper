import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const stakeholders = await prisma.stakeholder.findMany();
  console.log("Stakeholders:", stakeholders);

  const ayush = await prisma.executive.findFirst({
    where: { name: { contains: 'Ayush', mode: 'insensitive' } }
  });
  console.log("Ayush:", ayush);
}

main().catch(console.error).finally(() => prisma.$disconnect());
