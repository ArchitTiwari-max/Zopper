import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const admin = await prisma.user.findFirst({
      where: {
        roles: { has: 'ADMIN' },
        isActive: true
      }
    });

    const exec = await prisma.user.findFirst({
      where: {
        roles: { has: 'EXECUTIVE' },
        isActive: true
      }
    });

    console.log('--- DB Users ---');
    console.log('Admin User:', admin ? { id: admin.id, email: admin.email, username: admin.username } : 'None');
    console.log('Executive User:', exec ? { id: exec.id, email: exec.email, username: exec.username } : 'None');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
