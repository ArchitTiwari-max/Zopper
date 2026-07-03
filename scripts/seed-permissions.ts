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

    // Update UserRole table definitions
    await prisma.userRole.upsert({
      where: { name: 'ADMIN' },
      update: {
        permissions: ['ACCESS_ADMIN_PORTAL']
      },
      create: {
        name: 'ADMIN',
        permissions: ['ACCESS_ADMIN_PORTAL']
      }
    });

    await prisma.userRole.upsert({
      where: { name: 'SALES_EXECUTIVE' },
      update: {
        permissions: ['ACCESS_EXECUTIVE_PORTAL']
      },
      create: {
        name: 'SALES_EXECUTIVE',
        permissions: ['ACCESS_EXECUTIVE_PORTAL']
      }
    });

    for (const user of users) {
      let defaultPermissions: string[] = [];
      if (user.role === 'ADMIN') {
        defaultPermissions = ['ACCESS_ADMIN_PORTAL'];
        // Specially give custom permissions ONLY to test_admin
        if (user.username === 'test_admin') {
          defaultPermissions.push('MANAGE_STORE_IMPORT', 'MANAGE_USERS');
          console.log(`🌟 Specially assigning MANAGE_STORE_IMPORT and MANAGE_USERS to test_admin!`);
        }
      } else {
        defaultPermissions = ['ACCESS_EXECUTIVE_PORTAL'];
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          permissions: defaultPermissions
        }
      });

      if (user.role === 'ADMIN') adminsUpdated++;
      else executivesUpdated++;
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
