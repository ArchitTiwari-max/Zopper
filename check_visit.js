const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const exec = await prisma.executive.findFirst({ where: { name: 'Ayush Joshi' } });
  if (!exec) return console.log('Executive not found');
  console.log('Exec:', exec.name);

  const visits = await prisma.visit.findMany({
    where: { executiveId: exec.id },
    include: { store: true },
    orderBy: { createdAt: 'desc' },
    take: 15
  });

  const formatted = visits.map(v => ({
    id: v.id,
    storeName: v.store?.storeName,
    createdAt: v.createdAt.toISOString(),
    visitDate: v.visitDate ? v.visitDate.toISOString() : null,
    personMet: v.personMet,
    POSMchecked: v.POSMchecked,
    remarks: v.remarks,
    images: v.imageUrls.length,
    status: v.status
  }));

  console.log(JSON.stringify(formatted, null, 2));

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
