import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Starting removal of old role and roleId fields from all MongoDB documents...');

    const result = await prisma.$runCommandRaw({
      update: "User",
      updates: [
        {
          q: {},
          u: { $unset: { role: "", roleId: "", userRole: "" } },
          multi: true
        }
      ]
    });

    console.log('✅ Removal complete! Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error removing fields from MongoDB documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
