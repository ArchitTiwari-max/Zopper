import { PrismaClient } from '@prisma/client';

const ATLAS_URL = "mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0";

const prisma = new PrismaClient({
  datasources: { db: { url: ATLAS_URL } }
});

async function main() {
  try {
    const activeExecs = await prisma.user.findMany({
      where: {
        role: 'EXECUTIVE',
        isActive: true,
      },
      include: {
        executive: {
          include: {
            executiveStores: {
              where: { isFlagged: false },
              include: {
                store: {
                  select: {
                    storeName: true,
                    city: true,
                    storeChannel: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    });

    console.log(`\n========================================`);
    console.log(`  ACTIVE EXECUTIVE USERS REPORT`);
    console.log(`  Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`  Total Active Executives: ${activeExecs.length}`);
    console.log(`========================================\n`);

    let totalStores = 0;

    for (const user of activeExecs) {
      const exec = user.executive;
      const stores = exec?.executiveStores ?? [];
      totalStores += stores.length;

      console.log(`👤 ${exec?.name ?? user.username} (${user.username})`);
      console.log(`   Email    : ${user.email}`);
      console.log(`   Region   : ${exec?.region ?? 'N/A'}`);
      console.log(`   Contact  : ${exec?.contact_number ?? 'N/A'}`);
      console.log(`   Stores   : ${stores.length}`);

      if (stores.length === 0) {
        console.log(`   ⚠️  No stores assigned`);
      } else {
        stores.forEach((s, i) => {
          const city = s.store.city ? ` (${s.store.city})` : '';
          const channel = s.store.storeChannel ? ` [${s.store.storeChannel}]` : '';
          console.log(`     ${i + 1}. ${s.store.storeName}${city}${channel}`);
        });
      }

      console.log('');
    }

    console.log(`========================================`);
    console.log(`  SUMMARY`);
    console.log(`  Active Executives : ${activeExecs.length}`);
    console.log(`  Total Stores      : ${totalStores}`);
    console.log(`  Avg per Executive : ${activeExecs.length > 0 ? (totalStores / activeExecs.length).toFixed(1) : 0}`);
    console.log(`========================================\n`);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
