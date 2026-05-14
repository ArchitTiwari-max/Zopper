import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const store = await prisma.store.findFirst({
    where: { storeName: { contains: "AIR PAVILION" } },
    include: { executiveStores: { include: { executive: true } } }
  });
  console.log(JSON.stringify(store?.executiveStores, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
