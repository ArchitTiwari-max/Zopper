import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const desiredMappings = [
  {
    managerStr: 'Shrusti',
    subNames: ['rushikesh', 'santo', 'jesvin', 'jatin']
  },
  {
    managerStr: 'Sonal',
    subNames: ['konika', 'pratyush', 'nishant', 'megha', 'ankan']
  },
  {
    managerStr: 'Neeraj',
    subNames: ['anurag', 'abhishek', 'rohan', 'rajshri']
  },
  {
    managerStr: 'Ayush',
    subNames: ['avantika', 'sweety']
  }
];

async function main() {
  console.log('Fetching all executives to map by name...');
  const allExecs = await prisma.executive.findMany({ select: { id: true, name: true } });
  
  // Clear all mappings first
  for (const exec of allExecs) {
    await prisma.executive.update({
      where: { id: exec.id },
      data: { managerIds: [], subordinateIds: [] }
    });
  }
  console.log('Cleared existing mappings.');

  const managerToSubs = new Map<string, string[]>();
  const subToManagers = new Map<string, string[]>();

  for (const mapping of desiredMappings) {
    const manager = allExecs.find(e => e.name?.toLowerCase().includes(mapping.managerStr.toLowerCase()));
    if (!manager) {
      console.warn(`WARNING: Manager '${mapping.managerStr}' not found in DB!`);
      continue;
    }

    const subIds: string[] = [];
    for (const subName of mapping.subNames) {
      // Find the subordinate by partial match
      const sub = allExecs.find(e => e.name?.toLowerCase().includes(subName.toLowerCase()));
      if (sub) {
        subIds.push(sub.id);
        if (!subToManagers.has(sub.id)) subToManagers.set(sub.id, []);
        subToManagers.get(sub.id)!.push(manager.id);
      } else {
        if (subName !== 'akan') { // We added 'ankan' to handle 'akan' typo
          console.warn(`WARNING: Subordinate '${subName}' not found in DB!`);
        }
      }
    }
    
    // Deduplicate subIds
    const uniqueSubIds = Array.from(new Set(subIds));
    managerToSubs.set(manager.id, uniqueSubIds);
  }

  // Update Managers
  for (const [managerId, subs] of managerToSubs.entries()) {
    await prisma.executive.update({
      where: { id: managerId },
      data: { subordinateIds: subs }
    });
    const managerName = allExecs.find(e => e.id === managerId)?.name;
    console.log(`Updated Manager: ${managerName} (${managerId}) with ${subs.length} subordinates.`);
  }

  // Update Subordinates
  for (const [subId, managers] of subToManagers.entries()) {
    const uniqueManagers = Array.from(new Set(managers));
    await prisma.executive.update({
      where: { id: subId },
      data: { managerIds: uniqueManagers }
    });
    const subName = allExecs.find(e => e.id === subId)?.name;
    console.log(`Updated Subordinate: ${subName} (${subId}) with ${uniqueManagers.length} managers.`);
  }

  console.log('Mapping update complete!');
}

main().catch(e => console.error('Error during mapping:', e)).finally(() => prisma.$disconnect());
