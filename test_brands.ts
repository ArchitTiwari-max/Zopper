import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findFirst({
    where: { storeName: 'VS-Ts(Shah Ali Banda)' }
  });
  console.log("Store:", store?.storeName);
  console.log("partnerBrandIds:", store?.partnerBrandIds);
  const brands = await prisma.brand.findMany();
  console.log("All Brands:", brands.map(b => ({id: b.id, name: b.brandName})));
}
main().catch(console.error).finally(() => prisma.$disconnect());
