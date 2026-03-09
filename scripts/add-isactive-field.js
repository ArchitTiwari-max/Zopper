const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Starting to add isActive field to all users...');

    // Update all users to set isActive to true
    const result = await prisma.user.updateMany({
      data: {
        isActive: true,
      },
    });

    console.log(`✅ Successfully updated ${result.count} users with isActive = true`);
  } catch (error) {
    console.error('❌ Error updating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
