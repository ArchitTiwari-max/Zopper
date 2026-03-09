const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVisits() {
  try {
    const totalVisits = await prisma.visit.count();
    console.log(`📊 Total visits in database: ${totalVisits}`);

    const visitsWithoutVisitDate = await prisma.visit.count({
      where: { visitDate: null }
    });
    console.log(`📊 Visits with null visitDate: ${visitsWithoutVisitDate}`);

    if (totalVisits > 0) {
      const sample = await prisma.visit.findFirst({
        select: {
          id: true,
          createdAt: true,
          visitDate: true
        }
      });
      console.log('\n📋 Sample visit:');
      console.log(JSON.stringify(sample, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkVisits();
