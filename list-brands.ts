import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const brands = await prisma.brand.findMany({ select: { id: true, brandName: true } });
  console.log("Existing Brands:");
  brands.forEach(b => console.log(`- ${b.brandName} (${b.id})`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
