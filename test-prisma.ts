import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const visits = await prisma.stakeholderVisit.findMany({
    select: {
      id: true,
      stakeholder: { select: { brands: true } }
    },
    take: 1
  });
  console.log('Success:', visits);
}
main().catch(console.error).finally(() => prisma.$disconnect());
