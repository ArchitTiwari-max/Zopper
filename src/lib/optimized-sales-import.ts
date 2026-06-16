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
  stores: Map<string, { id: string; storeBrands: { brandId: string }[] }>;
  brands: Map<string, { id: string; brandName: string }>;
  categories: Map<string, { id: string; categoryName: string }>;
  storeBrandsById: Map<string, { storeId: string; brandId: string }>;
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
  
  const [stores, brands, categories, storeBrands] = await Promise.all([
    prisma.store.findMany({
      select: {
        id: true,
        storeBrands: {
          select: { brandId: true }
        }
      }
    }),
    prisma.brand.findMany({ select: { id: true, brandName: true } }),
    prisma.category.findMany({ select: { id: true, categoryName: true } }),
    prisma.storeBrand.findMany({
      where: { storeBrandId: { not: null } },
      select: { storeBrandId: true, storeId: true, brandId: true }
    })
  ]);

  globalCache = {
    stores: new Map(stores.map(s => [s.id, s])),
    brands: new Map(brands.map(b => [b.brandName, b])),
    categories: new Map(categories.map(c => [c.categoryName, c])),
    storeBrandsById: new Map(
      storeBrands
        .filter(sb => sb.storeBrandId)
        .map(sb => [sb.storeBrandId!, { storeId: sb.storeId, brandId: sb.brandId }])
    )
  };

  console.log(`✅ Cache initialized - ${stores.length} stores, ${brands.length} brands, ${categories.length} categories, ${storeBrands.length} storeBrand mappings`);
  return globalCache;
}

/**
 * Optimized sales processing with batch operations and caching
 */
export async function optimizedPostSales(rowObj: Record<string, any>, storeCount: number, cache: CacheData): Promise<string> {
  try {
    const { Store_ID, Brand, Category, ...monthMetrics } = rowObj;
    const categoryName = (Category && typeof Category === 'string' && Category.trim()) 
      ? Category.trim() 
      : 'Other';
    const context = `Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${categoryName}`;
    
    // Quick validation
    if (!Store_ID || !Brand) {
      return `❌ Missing Store_ID or Brand. ${context}`;
    }

    // Cache lookups (near-zero latency)
    const store = cache.stores.get(Store_ID);
    if (!store) return `❌ Store not found. ${context}`;
    
    const brand = cache.brands.get(Brand);
    if (!brand) return `❌ Brand not found. ${context}`;
    
    const category = cache.categories.get(categoryName);
    if (!category) return `❌ Category not found. ${context}`;
    
    if (!store.storeBrands.some(sb => sb.brandId === brand.id)) {
      return `❌ Brand is not mapped to this store. ${context}`;
    }

    // Process monthly sales data - support both DD-MM-YYYY and D/M/YYYY formats
    const salesByYear: Record<number, any[]> = {};
    for (const key in monthMetrics) {
      let match = key.match(/^([0-9]{1,2})-([0-9]{1,2})-([0-9]{4}) (.+)$/);
      if (!match) {
        match = key.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4}) (.+)$/);
      }
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
 * Optimized daily sales processing using StoreBrand_ID
 */
export async function optimizedPostDailySales(rowObj: Record<string, any>, successCount: number, cache: CacheData): Promise<string> {
  try {
    const { StoreBrand_ID, Category, ...dateMetrics } = rowObj;
    const categoryName = (Category && typeof Category === 'string' && Category.trim())
      ? Category.trim()
      : 'Other';
    const context = `StoreBrand_ID: ${StoreBrand_ID || 'N/A'}, Category: ${categoryName}`;

    if (!StoreBrand_ID) {
      return `❌ Missing StoreBrand_ID. ${context}`;
    }

    // Lookup store+brand via storeBrandId from cache
    const mapping = cache.storeBrandsById.get(String(StoreBrand_ID).trim());
    if (!mapping) return `❌ StoreBrand_ID not found in database. ${context}`;

    const category = cache.categories.get(categoryName);
    if (!category) return `❌ Category not found: "${categoryName}". ${context}`;

    // Build dailySales grouped by month ("1".."12"). Dates stored as DD-MM-YYYY
    const dailySalesByMonth: Record<string, any[]> = {};
    let detectedYear: number | null = null;
    for (const key in dateMetrics) {
      let match = key.match(/^([0-9]{1,2})-([0-9]{1,2})-([0-9]{4}) (Count of Sales|Revenue)$/);
      if (!match) {
        match = key.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4}) (Count of Sales|Revenue)$/);
      }
      if (!match) continue;
      const [_, dd, mm, yyyy, metric] = match;
      const monthNum = parseInt(mm, 10);
      const monthKey = String(monthNum);
      const date = `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy}`;
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

    return JSON.stringify({
      success: true,
      data: {
        storeId: mapping.storeId,
        brandId: mapping.brandId,
        categoryId: category.id,
        year,
        dailySales: dailySalesByMonth,
        context,
        successCount
      }
    });

  } catch (err) {
    console.error('Daily sales optimization error:', err);
    const { StoreBrand_ID, Category } = rowObj;
    return `❌ Internal server error for StoreBrand_ID: ${StoreBrand_ID || 'N/A'}, Category: ${Category || 'N/A'}`;
  }
}

/**
 * Helper function to merge incoming monthly sales data with existing data
 * Preserves existing months that aren't in the new import while updating overlapping ones
 */
const mergeMonthlySales = (
  existing: any[] | null | undefined,
  incoming: any[]
): any[] => {
  const result = new Map<number, any>();
  
  // First, preserve all existing months
  if (existing && Array.isArray(existing)) {
    for (const monthData of existing) {
      if (monthData && typeof monthData.month === 'number') {
        result.set(monthData.month, { ...monthData });
      }
    }
  }
  
  // Then, merge in the new data (overwrites same months, adds new months)
  for (const monthData of incoming) {
    if (monthData && typeof monthData.month === 'number') {
      result.set(monthData.month, { ...monthData });
    }
  }
  
  // Convert back to array and sort by month
  return Array.from(result.values()).sort((a, b) => a.month - b.month);
};

/**
 * Batch process sales records in chunks for maximum performance
 * Fixed to preserve existing monthly data when importing partial month updates
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
      const operations = chunk.map(async (record) => {
        for (const yearStr in record.salesByYear) {
          const year = parseInt(yearStr, 10);
          const incomingMonthlySales = record.salesByYear[year];
          
          const key = {
            storeId_brandId_categoryId_year: {
              storeId: record.storeId,
              brandId: record.brandId,
              categoryId: record.categoryId,
              year,
            }
          } as const;

          // Read existing record to merge monthly sales instead of overwriting
          const existing = await prisma.salesRecord.findUnique({
            where: key,
            select: { monthlySales: true }
          });

          // Merge existing monthly sales with incoming data
          const mergedMonthlySales = mergeMonthlySales(
            existing?.monthlySales as any[] | null,
            incomingMonthlySales
          );

          await prisma.salesRecord.upsert({
            where: key,
            update: { monthlySales: mergedMonthlySales },
            create: {
              storeId: record.storeId,
              brandId: record.brandId,
              categoryId: record.categoryId,
              year,
              monthlySales: mergedMonthlySales,
              dailySales: []
            }
          });
        }
      });

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

  // Helper to merge incoming dailySales into existing per month by date
  const mergeDailySales = (
    existing: Record<string, any[]> | null | undefined,
    incoming: Record<string, any[]>
  ): Record<string, any[]> => {
    const result: Record<string, any[]> = {};
    // Start with a shallow clone of existing months (preserve untouched months)
    if (existing) {
      for (const m of Object.keys(existing)) {
        const arr = Array.isArray(existing[m]) ? existing[m] : [];
        // clone to avoid mutating original
        result[m] = arr.map((e: any) => ({ ...e }));
      }
    }
    // Merge incoming per month by date (override same date entries)
    for (const m of Object.keys(incoming || {})) {
      const existingArr = result[m] || [];
      const mapByDate = new Map<string, any>();
      for (const e of existingArr) {
        if (e && e.date) mapByDate.set(String(e.date), { ...e });
      }
      const incomingArr = Array.isArray(incoming[m]) ? incoming[m] : [];
      for (const e of incomingArr) {
        if (!e || !e.date) continue;
        const key = String(e.date);
        const prev = mapByDate.get(key) || {};
        mapByDate.set(key, {
          ...prev,
          ...e,
        });
      }
      // Persist merged month back to result in stable order (by date string)
      const merged = Array.from(mapByDate.values());
      // Optional: keep sorted ascending by date (DD-MM-YYYY compares lexicographically by day first; but stable not required)
      result[m] = merged;
    }
    return result;
  };

  for (let i = 0; i < salesData.length; i += chunkSize) {
    const chunk = salesData.slice(i, i + chunkSize);
    
    // Log progress for large batches
    if (salesData.length > 100) {
      console.log(`Processing daily sales batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(salesData.length/chunkSize)} (${i + 1}-${Math.min(i + chunkSize, salesData.length)} of ${salesData.length} records)`);
    }
    
    try {
      const operations = chunk.map(async (record) => {
        const key = {
          storeId_brandId_categoryId_year: {
            storeId: record.storeId,
            brandId: record.brandId,
            categoryId: record.categoryId,
            year: record.year,
          }
        } as const;

        // Read existing to merge dailySales instead of overwriting
        const existing = await prisma.salesRecord.findUnique({
          where: key,
          select: { dailySales: true }
        });

        const mergedDaily = mergeDailySales(existing?.dailySales as Record<string, any[]> | null, record.dailySales);

        await prisma.salesRecord.upsert({
          where: key,
          update: { dailySales: mergedDaily },
          create: {
            storeId: record.storeId,
            brandId: record.brandId,
            categoryId: record.categoryId,
            year: record.year,
            monthlySales: [],
            dailySales: mergedDaily
          }
        });
      });

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