import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MonthlySalesData {
  month: number;
  deviceSales: number;
  planSales: number;
  attachPct: number;
  revenue: number;
}

interface DailySalesData {
  date: string; // Format: "2024-01-15"
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
          // Generate PAST 3 MONTHS sales data only
          const monthlySales: MonthlySalesData[] = [];
          const past3Months = getPast3Months(currentMonth, currentYear);

          for (const { month, year } of past3Months) {
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

          // Generate DAILY SALES data for current month
          const dailySales: DailySalesData[] = [];
          const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
          
          for (let day = 1; day <= daysInCurrentMonth; day++) {
            const avgRevenuePerDevice = getCategoryBasePrice(category.brandName);
            
            // Daily sales are typically smaller than monthly totals
            const baseDailyDeviceSales = Math.floor(Math.random() * 10) + 1; // 1-10 devices per day
            const deviceSales = baseDailyDeviceSales;
            
            const attachRate = 0.4 + Math.random() * 0.3; // 40-70% attach rate
            const planSales = Math.floor(deviceSales * attachRate);
            const attachPct = deviceSales > 0 ? Math.round((planSales / deviceSales) * 10000) / 10000 : 0;
            const revenue = deviceSales * avgRevenuePerDevice;

            const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            dailySales.push({
              date: dateStr,
              deviceSales,
              planSales,
              attachPct,
              revenue
            });
          }

          // Create sales record with both monthly and daily data
          try {
            await prisma.salesRecord.create({
              data: {
                storeId: store.id,
                brandId: brand.id,
                categoryId: category.id,
                year: currentYear,
                monthlySales: monthlySales,
                dailySales: dailySales
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

function getPast3Months(currentMonth: number, currentYear: number): { month: number; year: number }[] {
  const past3Months = [];
  
  for (let i = 1; i <= 3; i++) {
    let month = currentMonth - i;
    let year = currentYear;
    
    if (month <= 0) {
      month = 12 + month; // Handle year boundary
      year = currentYear - 1;
    }
    
    past3Months.unshift({ month, year }); // Add to beginning to maintain chronological order
  }
  
  return past3Months;
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