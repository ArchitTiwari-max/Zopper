import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.store.findMany();

  console.log(brands);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => prisma.$disconnect());
