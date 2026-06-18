import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0"
    }
  }
});

async function debug() {
  try {
    const totalUsers = await prisma.user.count();
    const activeExecUsers = await prisma.user.count({ where: { role: 'EXECUTIVE', isActive: true } });
    const allExecUsers = await prisma.user.count({ where: { role: 'EXECUTIVE' } });
    const allExecs = await prisma.executive.count();
    console.log(`Total Users: ${totalUsers}`);
    console.log(`All Exec Users: ${allExecUsers}, Active Exec Users: ${activeExecUsers}`);
    console.log(`All Executives: ${allExecs}`);

    // Let's get the active ones
    const activeUsersWithExec = await prisma.user.findMany({
      where: { role: 'EXECUTIVE', isActive: true },
      include: {
        executive: {
          include: {
            executiveStores: {
              where: { isFlagged: false },
              include: { store: true }
            }
          }
        }
      }
    });

    console.log(`Found ${activeUsersWithExec.length} active users with role EXECUTIVE.`);
    let execsWithUser = 0;
    for (const u of activeUsersWithExec) {
      if (u.executive) {
        execsWithUser++;
      }
    }
    console.log(`Out of those, ${execsWithUser} actually have an Executive record.`);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
debug();
