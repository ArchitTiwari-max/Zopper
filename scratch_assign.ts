import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Starting assignment...');
  
  // Set manager for Santo
  const res1 = await prisma.executive.update({
    where: { id: 'executive_00034' },
    data: { managerId: 'executive_00005' }
  }).catch(e => {
    console.error('Failed to update executive_00034', e);
  });
  
  if (res1) console.log(`Updated executive_00034 (Santo) with managerId: ${res1.managerId}`);

  // Set manager for Jesvin
  const res2 = await prisma.executive.update({
    where: { id: 'executive_00036' },
    data: { managerId: 'executive_00005' }
  }).catch(e => {
    console.error('Failed to update executive_00036', e);
  });

  if (res2) console.log(`Updated executive_00036 (Jesvin) with managerId: ${res2.managerId}`);
  
  console.log('Assignment completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
