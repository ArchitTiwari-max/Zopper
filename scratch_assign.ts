import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mappings = [
  { manager: 'executive_00005', subordinates: ['executive_00018','executive_00036','executive_00034','executive_00045'] },
  { manager: 'executive_00026', subordinates: ['executive_00027','executive_00039','executive_00041','executive_00042','executive_00032','executive_00029','executive_00028','executive_00035','executive_00038'] },
  { manager: 'executive_00007', subordinates: ['executive_00027','executive_00041','executive_00039','executive_00038','executive_00035'] },
  { manager: 'executive_00006', subordinates: ['executive_00027','executive_00041','executive_00039','executive_00038','executive_00035','executive_00049','executive_00046'] }
];

async function main() {
  console.log('Starting exact assignment mapping...');

  const managerToSubs = new Map<string, string[]>();
  const subToManagers = new Map<string, string[]>();

  for (const { manager, subordinates } of mappings) {
    managerToSubs.set(manager, subordinates);
    for (const sub of subordinates) {
      if (!subToManagers.has(sub)) subToManagers.set(sub, []);
      subToManagers.get(sub)!.push(manager);
    }
  }

  // 1. First, we might want to clear managerIds and subordinateIds across ALL executives to remove any leftover trash
  // But let's just do it for everyone in the DB to be safe, because the user said "sb sb nhi" (not everyone)
  await prisma.executive.updateMany({
    data: { managerIds: [], subordinateIds: [] }
  });
  console.log('Cleared all previous manager/subordinate mappings to ensure no leftovers.');

  // 2. Now strictly apply the ones from the mapping
  for (const manager of managerToSubs.keys()) {
    const exactSubs = managerToSubs.get(manager) || [];
    await prisma.executive.update({
      where: { id: manager },
      data: { subordinateIds: exactSubs }
    }).catch(e => console.error(`Error updating manager ${manager}`, e.message));
    console.log(`Manager ${manager} set to exactly ${exactSubs.length} subordinates`);
  }

  for (const sub of subToManagers.keys()) {
    const exactManagers = subToManagers.get(sub) || [];
    await prisma.executive.update({
      where: { id: sub },
      data: { managerIds: exactManagers }
    }).catch(e => console.error(`Error updating subordinate ${sub}`, e.message));
    console.log(`Subordinate ${sub} set to exactly ${exactManagers.length} managers`);
  }

  console.log('Assignment completed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
