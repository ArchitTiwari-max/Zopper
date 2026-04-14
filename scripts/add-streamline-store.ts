import {
  getPrismaInstance,
  initializeStoreCache,
  optimizedProcessStore,
  batchProcessStoreRecords,
  closePrismaConnection
} from '../src/lib/optimized-store-import';

async function main() {
  const prisma = getPrismaInstance();

  // Find max store ID to get the next one correctly
  const stores = await prisma.store.findMany({ select: { id: true } });
  let maxId = 'store_000000';
  for (const st of stores) {
    if (st.id.startsWith('store_')) {
      const num1 = parseInt(st.id.split('_')[1], 10);
      const num2 = parseInt(maxId.split('_')[1], 10);
      if (num1 > num2) {
        maxId = st.id;
      }
    }
  }
  
  const num = parseInt(maxId.replace('store_', ''), 10) + 1;
  const newStoreId = `store_${num.toString().padStart(6, '0')}`;

  console.log(`Using new Store ID: ${newStoreId}`);

  // Need executive ID and Brand ID, but hardeep and hitachi are already determined:
  const hitachi = await prisma.brand.findFirst({ where: { brandName: { contains: 'Hitachi' } } });
  const hardeep = await prisma.executive.findFirst({ where: { name: { contains: 'Hardeep' } } });

  console.log(`Hitachi ID: ${hitachi?.id}, Hardeep Executive ID: ${hardeep?.id}`);

  // "Not Categorized" means we leave it empty. The DB handles it automatically.
  const rowObj = {
    "Store_ID": newStoreId,
    "Store Name": "streamline air conditioner",
    "City": "indore",
    "partnerBrandIds": hitachi?.id || "brand_003",
    "partnerBrandTypes": "", // Empty signifies Not Categorized
    "Executive_IDs": hardeep?.id || "executive_00022"
  };

  const cache = await initializeStoreCache(prisma);

  const resultStr = await optimizedProcessStore(rowObj, 1, cache);
  console.log('Processed row:', resultStr);

  const result = JSON.parse(resultStr);

  if (result.success) {
    const batchResult = await batchProcessStoreRecords([result.data], prisma);
    console.log('Batch result:', batchResult);
  } else {
    console.log('Validation failed');
  }

  await closePrismaConnection();
}

main().catch(console.error);
