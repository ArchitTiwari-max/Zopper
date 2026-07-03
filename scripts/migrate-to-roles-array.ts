import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Starting migration of single role to roles array...');
    
    const users = await prisma.user.findMany();
    console.log(`📋 Found ${users.length} users in the database.`);

    let updatedCount = 0;

    for (const user of users) {
      const currentRole = user.role || 'EXECUTIVE';
      const existingRoles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [];

      if (existingRoles.length === 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            roles: [currentRole]
          }
        });
        updatedCount++;
      }
    }

    console.log(`✅ Migration complete! Updated ${updatedCount} user(s) with roles array.`);
    
  } catch (error) {
    console.error('❌ Error migrating roles array:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
