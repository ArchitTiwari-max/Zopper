import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ayushId = 'executive_00007';

  // 1. Delete all existing ExecutiveStakeholderAssignments
  await prisma.executiveStakeholderAssignment.deleteMany({});
  
  // 2. Delete all existing Stakeholders
  await prisma.stakeholder.deleteMany({});

  // 3. Create new stakeholders with stake_xxxx format and assign them
  const dummyData = [
    { name: 'Rahul Sharma', designation: 'Regional Sales Manager', city: 'Mumbai' },
    { name: 'Priya Mehta', designation: 'Area Business Manager', city: 'Delhi' },
    { name: 'Anil Verma', designation: 'Key Account Manager', city: 'Bangalore' },
    { name: 'Sunita Joshi', designation: 'Territory Manager', city: 'Pune' },
    { name: 'Vikram Patel', designation: 'Zonal Head', city: 'Ahmedabad' }
  ];

  for (let i = 0; i < dummyData.length; i++) {
    const id = `stake_${(i + 1).toString().padStart(4, '0')}`; // e.g. stake_0001
    const s = dummyData[i];

    console.log(`Creating ${id}: ${s.name}`);
    await prisma.stakeholder.create({
      data: {
        id,
        name: s.name,
        designation: s.designation,
        city: s.city,
        brands: [],
        isActive: true,
      }
    });

    await prisma.executiveStakeholderAssignment.create({
      data: {
        executiveId: ayushId,
        stakeholderId: id
      }
    });
  }
  
  console.log("Done recreating stakeholders and assigning them to Ayush.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
