const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRAGData() {
  try {
    console.log('🔍 Checking RAG-compatible data in database...\n');

    // Check stores with partner brand types
    const stores = await prisma.store.findMany({
      take: 5,
      select: {
        id: true,
        storeName: true,
        partnerBrandIds: true,
        partnerBrandTypes: true,
        salesRecords: {
          take: 3,
          include: {
            brand: {
              select: {
                brandName: true
              }
            }
          }
        }
      }
    });

    console.log(`📊 Found ${stores.length} stores total`);
    
    stores.forEach((store, index) => {
      console.log(`\n[${index + 1}] Store: ${store.storeName} (${store.id})`);
      console.log(`   Partner Brand IDs: ${store.partnerBrandIds?.join(', ') || 'None'}`);
      console.log(`   Partner Brand Types: ${store.partnerBrandTypes?.join(', ') || 'None'}`);
      console.log(`   Sales Records: ${store.salesRecords.length}`);
      
      store.salesRecords.forEach((record, i) => {
        console.log(`     [${i + 1}] Brand: ${record.brand.brandName}, Year: ${record.year}`);
        
        // Check if monthlySales has the required attachPct data
        if (record.monthlySales && Array.isArray(record.monthlySales)) {
          const monthsWithAttachPct = record.monthlySales.filter(m => m.attachPct !== undefined).length;
          console.log(`         Monthly data: ${record.monthlySales.length} months, ${monthsWithAttachPct} with attachPct`);
          
          // Show first month sample
          if (record.monthlySales.length > 0) {
            const sample = record.monthlySales[0];
            console.log(`         Sample (Month ${sample.month}): deviceSales=${sample.deviceSales}, planSales=${sample.planSales}, attachPct=${sample.attachPct}`);
          }
        } else {
          console.log(`         ❌ No monthly sales data or not array`);
        }
      });
    });

    // Check current month for testing
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    console.log(`\n📅 Current: Month ${currentMonth}, Year ${currentYear}`);

    // Count stores with the required data structure
    const totalStores = await prisma.store.count();
    const storesWithBrandTypes = await prisma.store.count({
      where: {
        partnerBrandTypes: {
          isEmpty: false
        }
      }
    });
    const storesWithSales = await prisma.store.count({
      where: {
        salesRecords: {
          some: {
            year: currentYear
          }
        }
      }
    });

    console.log(`\n📈 Data Availability:`);
    console.log(`   Total Stores: ${totalStores}`);
    console.log(`   Stores with Partner Brand Types: ${storesWithBrandTypes}`);
    console.log(`   Stores with ${currentYear} Sales Records: ${storesWithSales}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRAGData();