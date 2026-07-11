import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roleName = 'WORKUSER';
  const permission = 'ACCESS_WORKDOST_PORTAL';

  try {
    const existing = await prisma.userRole.findUnique({
      where: { name: roleName }
    });

    if (existing) {
      console.log(`Role "${roleName}" already exists.`);
      if (!existing.permissions.includes(permission)) {
        await prisma.userRole.update({
          where: { id: existing.id },
          data: {
            permissions: [...existing.permissions, permission]
          }
        });
        console.log(`Added permission "${permission}" to role "${roleName}".`);
      } else {
        console.log(`Permission "${permission}" is already present in role "${roleName}".`);
      }
    } else {
      const newRole = await prisma.userRole.create({
        data: {
          name: roleName,
          permissions: [permission]
        }
      });
      console.log(`Created role "${roleName}" with permission "${permission}".`);
    }
  } catch (error) {
    console.error('Error creating role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
