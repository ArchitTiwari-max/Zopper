const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fetching stakeholders...');
  try {
    const s = await prisma.stakeholder.findMany();
    console.log('Got', s.length, 'stakeholders.');
  } catch(e) {
    console.error('Error fetching stakeholders:', e);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
