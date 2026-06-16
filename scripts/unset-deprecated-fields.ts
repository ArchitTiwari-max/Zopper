import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Starting migration to unset partnerBrandIds and partnerBrandTypes from Store collection...');
    
    const result = await prisma.$runCommandRaw({
      update: "Store",
      updates: [
        {
          q: {},
          u: { $unset: { partnerBrandIds: "", partnerBrandTypes: "" } },
          multi: true
        }
      ]
    });

    console.log('Migration completed successfully.');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
