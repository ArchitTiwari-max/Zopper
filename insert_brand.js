const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brandName = 'Nothing';
  let brand = await prisma.brand.findUnique({ where: { brandName } });
  
  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        id: brandName.toLowerCase(),
        brandName: brandName
      }
    });
    console.log(`Brand '${brandName}' created with id: ${brand.id}`);
  } else {
    console.log(`Brand '${brandName}' already exists with id: ${brand.id}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
