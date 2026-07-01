import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find all stakeholders that have an ObjectId format (length 24, hex)
  const stakeholders = await prisma.stakeholder.findMany();
  
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  const toDelete = stakeholders.filter(s => objectIdRegex.test(s.id));
  
  console.log(`Found ${toDelete.length} old stakeholders to delete.`);
  
  if (toDelete.length > 0) {
    const ids = toDelete.map(s => s.id);
    // Delete assignments for these stakeholders
    await prisma.executiveStakeholderAssignment.deleteMany({
      where: { stakeholderId: { in: ids } }
    });
    
    // Delete the stakeholders themselves
    await prisma.stakeholder.deleteMany({
      where: { id: { in: ids } }
    });
    console.log(`Successfully deleted ${toDelete.length} old stakeholders.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
