import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Seeding user permissions...');
    
    // Fetch all users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users in the database.`);

    let adminsUpdated = 0;
    let executivesUpdated = 0;

    for (const user of users) {
      const defaultPermissions = user.role === 'ADMIN' 
        ? ['ACCESS_ADMIN_PORTAL'] 
        : ['ACCESS_EXECUTIVE_PORTAL'];

      // Only update if they don't have the correct permissions set already
      const hasPermissions = user.permissions && user.permissions.length > 0;
      const isCorrect = hasPermissions && user.permissions.includes(defaultPermissions[0]);

      if (!isCorrect) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            permissions: defaultPermissions
          }
        });

        if (user.role === 'ADMIN') adminsUpdated++;
        else executivesUpdated++;
      }
    }

    console.log(`✅ Seeding complete!`);
    console.log(`Updated ${adminsUpdated} Admin(s) with 'ACCESS_ADMIN_PORTAL'`);
    console.log(`Updated ${executivesUpdated} Executive(s) with 'ACCESS_EXECUTIVE_PORTAL'`);
    
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
