import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MonthlySalesData {
  month: number;
  deviceSales: number;
  planSales: number;
  attachPct: number;
  revenue: number;
}

async function seedSalesData() {
  try {
    console.log('🌱 Starting sales data seeding...');

    // Get all stores, brands, and categories
    const [stores, brands, categories] = await Promise.all([
      prisma.store.findMany({ select: { id: true } }),
      prisma.brand.findMany({ select: { id: true, brandName: true } }),
      prisma.category.findMany({ select: { id: true, brandName: true } })
    ]);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    let recordsCreated = 0;

    // Generate sales records for each store-brand-category combination
    for (const store of stores) {
      for (const brand of brands) {
        for (const category of categories) {
          // Generate monthly sales data for current year
          const monthlySales: MonthlySalesData[] = [];

          for (let month = 1; month <= currentMonth; month++) {
            const avgRevenuePerDevice = getCategoryBasePrice(category.brandName);
            const seasonalMultiplier = getSeasonalMultiplier(month, category.brandName);
            
            // Base sales with randomization
            const baseDeviceSales = Math.floor(Math.random() * 100) + 20; // 20-120 devices
            const deviceSales = Math.floor(baseDeviceSales * seasonalMultiplier);
            
            const attachRate = 0.4 + Math.random() * 0.3; // 40-70% attach rate
            const planSales = Math.floor(deviceSales * attachRate);
            const attachPct = deviceSales > 0 ? Math.round((planSales / deviceSales) * 10000) / 10000 : 0;
            const revenue = deviceSales * avgRevenuePerDevice;

            monthlySales.push({
              month,
              deviceSales,
              planSales,
              attachPct,
              revenue
            });
          }

          // Create sales record
          try {
            await prisma.salesRecord.create({
              data: {
                storeId: store.id,
                brandId: brand.id,
                categoryId: category.id,
                year: currentYear,
                monthlySales: monthlySales
              }
            });
            recordsCreated++;
          } catch (error) {
            // Handle duplicate records gracefully
            console.log(`⚠️ Record already exists for store ${store.id}, brand ${brand.brandName}, category ${category.brandName}`);
          }
        }
      }
    }

    console.log(`✅ Sales data seeding completed! Created ${recordsCreated} records.`);

  } catch (error) {
    console.error('❌ Error seeding sales data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function getCategoryBasePrice(category: string): number {
  switch (category.toLowerCase()) {
    case 'smartphone': return 15000;
    case 'tablet': return 25000;
    case 'accessories': return 3000;
    case 'wearables': return 8000;
    default: return 10000;
  }
}

function getSeasonalMultiplier(month: number, category: string): number {
  // Festival seasons in India: Oct-Nov (Diwali), Mar-Apr (Holi/New Year)
  const festivalMonths = [3, 4, 10, 11];
  const isFestivalMonth = festivalMonths.includes(month);
  
  let multiplier = 1.0;
  
  if (isFestivalMonth) {
    multiplier = category.toLowerCase() === 'smartphone' ? 1.5 : 1.3;
  } else if (month === 12 || month === 1) {
    multiplier = 1.2; // Year-end/New year sales
  } else if ([6, 7, 8].includes(month)) {
    multiplier = 0.8; // Lower sales during monsoon
  }
  
  return multiplier;
}

// Run the seeder
if (require.main === module) {
  seedSalesData();
}

export default seedSalesData;