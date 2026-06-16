const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allStores = await prisma.store.findMany({
    select: { id: true, storeName: true, city: true }
  });

  const vsStores = allStores.filter(store => {
    if (!store.storeName) return false;
    const nameLower = store.storeName.toLowerCase();
    return nameLower.includes('vs');
  });

  console.log(`Total stores containing 'vs' (case-insensitive): ${vsStores.length}`);
  
  // Categorize them:
  // 1. Starts with VS or VS- or VS_ or VS 
  const startsWithVS = vsStores.filter(s => /^vs[-_\s]/i.test(s.storeName));
  // 2. Contains "vijay sales"
  const containsVijaySales = vsStores.filter(s => s.storeName.toLowerCase().includes('vijay sales'));
  // 3. Other cases (e.g. contains 'vs' but doesn't start with it and doesn't contain 'vijay sales')
  const others = vsStores.filter(s => !startsWithVS.includes(s) && !containsVijaySales.includes(s));

  console.log(`Starts with VS (e.g. VS-): ${startsWithVS.length}`);
  console.log(`Contains 'vijay sales': ${containsVijaySales.length}`);
  console.log(`Others containing 'vs': ${others.length}`);

  if (others.length > 0) {
    console.log("\nFirst 30 of 'Others':");
    console.log(others.slice(0, 30).map(s => `ID: ${s.id} | Name: ${s.storeName} | City: ${s.city}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
