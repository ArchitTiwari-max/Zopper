import { PrismaClient } from '@prisma/client';

// Singleton Prisma instance with connection pooling
let prismaInstance: PrismaClient | null = null;

export function getPrismaInstance(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }
  return prismaInstance;
}

// Cache interfaces for better performance
interface CacheData {
  stores: Map<string, { id: string; partnerBrandIds: string[] }>;
  brands: Map<string, { id: string; brandName: string }>;
  categories: Map<string, { id: string; categoryName: string }>;
  categoryBrands: Map<string, { brandId: string; categoryId: string }>;
}

// Global cache - reused across requests
let globalCache: CacheData | null = null;

/**
 * Initialize cache with all reference data upfront
 * This eliminates 99% of database lookups during import
 */
async function initializeCache(prisma: PrismaClient): Promise<CacheData> {
  if (globalCache) {
    return globalCache;
  }

  console.log('🔄 Initializing reference data cache...');
  
  const [stores, brands, categories, categoryBrands] = await Promise.all([
    prisma.store.findMany({ select: { id: true, partnerBrandIds: true } }),
    prisma.brand.findMany({ select: { id: true, brandName: true } }),
    prisma.category.findMany({ select: { id: true, categoryName: true } }),
    prisma.categoryBrand.findMany({ select: { brandId: true, categoryId: true } })
  ]);

  globalCache = {
    stores: new Map(stores.map(s => [s.id, s])),
    brands: new Map(brands.map(b => [b.brandName, b])),
    categories: new Map(categories.map(c => [c.categoryName, c])),
    categoryBrands: new Map(categoryBrands.map(cb => [`${cb.brandId}_${cb.categoryId}`, cb]))
  };

  console.log(`✅ Cache initialized - ${stores.length} stores, ${brands.length} brands, ${categories.length} categories`);
  return globalCache;
}

/**
 * Optimized sales processing with batch operations and caching
 */
export async function optimizedPostSales(rowObj: Record<string, any>, storeCount: number, cache: CacheData): Promise<string> {
  try {
    const { Store_ID, Brand, Category, ...monthMetrics } = rowObj;
    const context = `Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
    
    // Quick validation
    if (!Store_ID || !Brand || !Category) {
      return `❌ Missing Store_ID, Brand, or Category. ${context}`;
    }

    // Cache lookups (near-zero latency)
    const store = cache.stores.get(Store_ID);
    if (!store) return `❌ Store not found. ${context}`;
    
    const brand = cache.brands.get(Brand);
    if (!brand) return `❌ Brand not found. ${context}`;
    
    const category = cache.categories.get(Category);
    if (!category) return `❌ Category not found. ${context}`;
    
    if (!store.partnerBrandIds.includes(brand.id)) {
      return `❌ Brand is not mapped to this store. ${context}`;
    }
    
    const catBrandKey = `${brand.id}_${category.id}`;
    if (!cache.categoryBrands.has(catBrandKey)) {
      return `❌ Category is not mapped to this brand. ${context}`;
    }

    // Process monthly sales data
    const salesByYear: Record<number, any[]> = {};
    for (const key in monthMetrics) {
      const match = key.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4}) (.+)$/);
      if (!match) continue;
      const [_, dd, mm, yyyy, metric] = match;
      const year = parseInt(yyyy, 10);
      const month = parseInt(mm, 10);
      if (!salesByYear[year]) salesByYear[year] = [];
      let entry = salesByYear[year].find(e => e.month === month);
      if (!entry) {
        entry = { month };
        salesByYear[year].push(entry);
      }
      if (/device sales/i.test(metric)) entry.deviceSales = monthMetrics[key] || 0;
      if (/plan sales/i.test(metric)) entry.planSales = monthMetrics[key] || 0;
      if (/attach ?%/i.test(metric)) entry.attachPct = monthMetrics[key] || 0;
      if (/revenue/i.test(metric)) entry.revenue = monthMetrics[key] || 0;
    }

    // Return prepared data for batch processing instead of immediate DB write
    return JSON.stringify({
      success: true,
      data: {
        storeId: Store_ID,
        brandId: brand.id,
        categoryId: category.id,
        salesByYear,
        context,
        storeCount
      }
    });
    
  } catch (err) {
    console.error('Optimization error:', err);
    const { Store_ID, Brand, Category } = rowObj;
    return `❌ Internal server error for Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
  }
}

/**
 * Optimized daily sales processing
 */
export async function optimizedPostDailySales(rowObj: Record<string, any>, successCount: number, cache: CacheData): Promise<string> {
  try {
    const { Store_ID, Brand, Category, ...dateMetrics } = rowObj;
    const context = `Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
    
    if (!Store_ID || !Brand || !Category) {
      return `❌ Missing Store_ID, Brand, or Category. ${context}`;
    }
    
    // Cache lookups (near-zero latency)
    const store = cache.stores.get(Store_ID);
    if (!store) return `❌ Store not found. ${context}`;
    
    const brand = cache.brands.get(Brand);
    if (!brand) return `❌ Brand not found. ${context}`;
    
    const category = cache.categories.get(Category);
    if (!category) return `❌ Category not found. ${context}`;
    
    if (!store.partnerBrandIds.includes(brand.id)) {
      return `❌ Brand is not mapped to this store. ${context}`;
    }
    
    const catBrandKey = `${brand.id}_${category.id}`;
    if (!cache.categoryBrands.has(catBrandKey)) {
      return `❌ Category is not mapped to this brand. ${context}`;
    }

    // Build dailySales grouped by month ("1".."12"). Dates stored as DD-MM-YYYY
    const dailySalesByMonth: Record<string, any[]> = {};
    let detectedYear: number | null = null;
    for (const key in dateMetrics) {
      const match = key.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4}) (Count of Sales|Revenue)$/);
      if (!match) continue;
      const [_, dd, mm, yyyy, metric] = match;
      const monthNum = parseInt(mm, 10);
      const monthKey = String(monthNum); // "1".."12"
      const date = `${dd}-${mm}-${yyyy}`; // DD-MM-YYYY per schema note
      detectedYear = detectedYear ?? parseInt(yyyy, 10);

      if (!dailySalesByMonth[monthKey]) dailySalesByMonth[monthKey] = [];
      let entry = dailySalesByMonth[monthKey].find(e => e.date === date);
      if (!entry) {
        entry = { date };
        dailySalesByMonth[monthKey].push(entry);
      }

      if (/count of sales/i.test(metric)) entry.countOfSales = dateMetrics[key] || 0;
      if (/revenue/i.test(metric)) entry.revenue = dateMetrics[key] || 0;
    }

    const year = detectedYear ?? new Date().getFullYear();
    
    // Return prepared data for batch processing
    return JSON.stringify({
      success: true,
      data: {
        storeId: Store_ID,
        brandId: brand.id,
        categoryId: category.id,
        year,
        dailySales: dailySalesByMonth,
        context,
        successCount
      }
    });
    
  } catch (err) {
    console.error('Daily sales optimization error:', err);
    const { Store_ID, Brand, Category } = rowObj;
    return `❌ Internal server error for Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
  }
}

/**
 * Batch process sales records in chunks for maximum performance
 */
export async function batchProcessSalesRecords(
  salesData: Array<{
    storeId: string;
    brandId: string;
    categoryId: string;
    salesByYear: Record<number, any[]>;
    context: string;
  }>,
  chunkSize = 50
): Promise<{ successful: number; failed: number; errors: string[] }> {
  const prisma = getPrismaInstance();
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process in chunks to avoid overwhelming the database
  for (let i = 0; i < salesData.length; i += chunkSize) {
    const chunk = salesData.slice(i, i + chunkSize);
    
    // Log progress for large batches
    if (salesData.length > 100) {
      console.log(`Processing batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(salesData.length/chunkSize)} (${i + 1}-${Math.min(i + chunkSize, salesData.length)} of ${salesData.length} records)`);
    }
    
    try {
      const operations = [];
      
      for (const record of chunk) {
        for (const yearStr in record.salesByYear) {
          const year = parseInt(yearStr, 10);
          const monthlySales = record.salesByYear[year];
          
          operations.push(
            prisma.salesRecord.upsert({
              where: {
                storeId_brandId_categoryId_year: {
                  storeId: record.storeId,
                  brandId: record.brandId,
                  categoryId: record.categoryId,
                  year,
                }
              },
              update: { monthlySales },
              create: {
                storeId: record.storeId,
                brandId: record.brandId,
                categoryId: record.categoryId,
                year,
                monthlySales,
                dailySales: []
              }
            })
          );
        }
      }

      // Execute all operations in this chunk concurrently
      await Promise.all(operations);
      successful += chunk.length;
      
    } catch (error) {
      failed += chunk.length;
      const errorMsg = `❌ Batch processing error for chunk ${i}-${i + chunkSize}: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  return { successful, failed, errors };
}

/**
 * Batch process daily sales records
 */
export async function batchProcessDailySalesRecords(
  salesData: Array<{
    storeId: string;
    brandId: string;
    categoryId: string;
    year: number;
    dailySales: Record<string, any[]>; // grouped by month { "1": [...], ... }
    context: string;
  }>,
  chunkSize = 50
): Promise<{ successful: number; failed: number; errors: string[] }> {
  const prisma = getPrismaInstance();
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < salesData.length; i += chunkSize) {
    const chunk = salesData.slice(i, i + chunkSize);
    
    // Log progress for large batches
    if (salesData.length > 100) {
      console.log(`Processing daily sales batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(salesData.length/chunkSize)} (${i + 1}-${Math.min(i + chunkSize, salesData.length)} of ${salesData.length} records)`);
    }
    
    try {
      const operations = chunk.map(record =>
        prisma.salesRecord.upsert({
          where: {
            storeId_brandId_categoryId_year: {
              storeId: record.storeId,
              brandId: record.brandId,
              categoryId: record.categoryId,
              year: record.year,
            }
          },
          update: { dailySales: record.dailySales },
          create: {
            storeId: record.storeId,
            brandId: record.brandId,
            categoryId: record.categoryId,
            year: record.year,
            monthlySales: [],
            dailySales: record.dailySales
          }
        })
      );

      await Promise.all(operations);
      successful += chunk.length;
      
    } catch (error) {
      failed += chunk.length;
      const errorMsg = `❌ Daily batch processing error for chunk ${i}-${i + chunkSize}: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  return { successful, failed, errors };
}

// Export cache initialization
export { initializeCache };

// Clean up function
export async function closePrismaConnection() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    globalCache = null;
  }
}