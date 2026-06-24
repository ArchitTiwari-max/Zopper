import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all SalesRecord documents...');
  const records = await prisma.salesRecord.findMany();
  console.log(`Fetched ${records.length} records. Writing to file...`);
  
  const backupPath = path.join(__dirname, '..', 'sales_record_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(records, null, 2));
  
  console.log(`✅ Backup successfully saved to: ${backupPath}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
