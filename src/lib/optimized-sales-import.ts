import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

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
  subCategories: Map<string, { id: string; name: string }>;
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
  
  const [stores, brands, categories, storeBrands, subCategories] = await Promise.all([
    prisma.store.findMany({
      select: {
        id: true,
        storeBrands: {
          select: { brandId: true }
        }
      }
    }),
    prisma.brand.findMany({ select: { id: true, brandName: true } }),
    prisma.productCategory.findMany({ select: { id: true, categoryName: true } }),
    prisma.storeBrand.findMany({
      where: { storeBrandId: { not: null } },
      select: { storeBrandId: true, storeId: true, brandId: true }
    }),
    prisma.productSubCategory.findMany({
      select: { id: true, name: true }
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
    ),
    subCategories: new Map(subCategories.map(sc => [sc.name.toUpperCase().trim(), sc]))
  };

  console.log(`✅ Cache initialized - ${stores.length} stores, ${brands.length} brands, ${categories.length} categories, ${storeBrands.length} storeBrand mappings, ${subCategories.length} sub-categories`);
  return globalCache;
}

/**
 * Optimized sales processing with batch operations and caching
 */
export async function optimizedPostSales(rowObj: Record<string, any>, storeCount: number, cache: CacheData): Promise<string> {
  try {
    const { StoreBrand_ID, ...remaining } = rowObj;
    const categoryVal = rowObj['Product Category'] || rowObj.Category || rowObj.ProductCategory || rowObj.category;
    const categoryName = (categoryVal && typeof categoryVal === 'string' && categoryVal.trim()) 
      ? categoryVal.trim() 
      : 'Other';
    const context = `StoreBrand_ID: ${StoreBrand_ID || 'N/A'}, Product Category: ${categoryName}`;
    
    // Quick validation
    if (!StoreBrand_ID) {
      return `❌ Missing StoreBrand_ID. ${context}`;
    }

    // Cache lookup (near-zero latency)
    const mapping = cache.storeBrandsById.get(String(StoreBrand_ID).trim());
    if (!mapping) return `❌ StoreBrand_ID not found in database. ${context}`;
    
    const category = cache.categories.get(categoryName);
    if (!category) return `❌ Product Category not found. ${context}`;

    // Process monthly sales data - support both DD-MM-YYYY and D/M/YYYY formats
    const monthMetrics: Record<string, any> = {};
    for (const key in remaining) {
      if (!['StoreBrand_ID', 'Category', 'Product Category', 'ProductCategory', 'category'].includes(key)) {
        monthMetrics[key] = remaining[key];
      }
    }

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
        storeId: mapping.storeId,
        brandId: mapping.brandId,
        productCategoryId: category.id,
        salesByYear,
        context,
        storeCount
      }
    });
    
  } catch (err) {
    console.error('Optimization error:', err);
    const { StoreBrand_ID } = rowObj;
    const categoryVal = rowObj['Product Category'] || rowObj.Category || rowObj.ProductCategory || rowObj.category;
    return `❌ Internal server error for StoreBrand_ID: ${StoreBrand_ID || 'N/A'}, Product Category: ${categoryVal || 'N/A'}`;
  }
}

/**
 * Optimized daily sales processing using StoreBrand_ID
 */
export async function optimizedPostDailySales(rowObj: Record<string, any>, successCount: number, cache: CacheData): Promise<string> {
  try {
    const { StoreBrand_ID, ...remaining } = rowObj;
    const categoryVal = rowObj['Product Category'] || rowObj.Category || rowObj.ProductCategory || rowObj.category;
    const categoryName = (categoryVal && typeof categoryVal === 'string' && categoryVal.trim())
      ? categoryVal.trim()
      : 'Other';
    const context = `StoreBrand_ID: ${StoreBrand_ID || 'N/A'}, Product Category: ${categoryName}`;

    if (!StoreBrand_ID) {
      return `❌ Missing StoreBrand_ID. ${context}`;
    }

    // Lookup store+brand via storeBrandId from cache
    const mapping = cache.storeBrandsById.get(String(StoreBrand_ID).trim());
    if (!mapping) return `❌ StoreBrand_ID not found in database. ${context}`;

    const category = cache.categories.get(categoryName);
    if (!category) return `❌ Product Category not found: "${categoryName}". ${context}`;

    // Extract metadata values
    const subCategoryVal = rowObj['Product Sub Category'] || rowObj.ProductSubCategory || rowObj.productSubCategory || rowObj.subcategory;
    const modelNameVal = rowObj['Model Name'] || rowObj.ModelName || rowObj.modelName;
    const planTypeVal = rowObj['Plan Type'] || rowObj.PlanType || rowObj.planType;

    // Handle product subcategory (dynamically create if not found)
    let productSubCategoryId: string = 'subcat_na';
    const subCategoryName = subCategoryVal ? String(subCategoryVal).trim() : 'N/A';
    if (subCategoryName !== 'N/A') {
      const cacheKey = subCategoryName.toUpperCase();
      let subCat = cache.subCategories.get(cacheKey);
      if (!subCat) {
        const prisma = getPrismaInstance();
        const newSubCat = await prisma.productSubCategory.upsert({
          where: { name: subCategoryName },
          update: {},
          create: {
            id: `subcat_${uuidv4().replace(/-/g, '').substring(0, 8)}`,
            name: subCategoryName
          }
        });
        cache.subCategories.set(cacheKey, newSubCat);
        productSubCategoryId = newSubCat.id;
      } else {
        productSubCategoryId = subCat.id;
      }
    } else {
      // Find or create 'N/A' subcategory
      const cacheKey = 'N/A';
      let subCat = cache.subCategories.get(cacheKey);
      if (!subCat) {
        const prisma = getPrismaInstance();
        const newSubCat = await prisma.productSubCategory.upsert({
          where: { name: 'N/A' },
          update: {},
          create: {
            id: 'subcat_na',
            name: 'N/A'
          }
        });
        cache.subCategories.set(cacheKey, newSubCat);
        productSubCategoryId = newSubCat.id;
      } else {
        productSubCategoryId = subCat.id;
      }
    }

    // Validate plan type against the enum values
    let planType: any = 'NA';
    if (planTypeVal) {
      const cleanPlanType = String(planTypeVal).trim().toUpperCase();
      const planTypeMapping: Record<string, string> = {
        'ADLD': 'ADLD',
        'SP': 'SP',
        'COMBO': 'COMBO',
        'EW': 'EW',
        'NA': 'NA',
        'EW - 1YR': 'EW_1YR',
        'EW - 2YR': 'EW_2YR',
        'EW - 3YR': 'EW_3YR',
        'EW - 4YR': 'EW_4YR',
        'EW_1YR': 'EW_1YR',
        'EW_2YR': 'EW_2YR',
        'EW_3YR': 'EW_3YR',
        'EW_4YR': 'EW_4YR',
        'EW-1YR': 'EW_1YR',
        'EW-2YR': 'EW_2YR',
        'EW-3YR': 'EW_3YR',
        'EW-4YR': 'EW_4YR',
      };
      if (planTypeMapping[cleanPlanType]) {
        planType = planTypeMapping[cleanPlanType];
      } else {
        return `❌ Invalid Plan Type: "${planTypeVal}". Allowed values are ADLD, SP, COMBO, EW, Ew - 1yr, Ew - 2yr, Ew - 3yr, Ew - 4yr, NA. ${context}`;
      }
    }

    // Filter out Category and other metadata key references from dateMetrics
    const metadataKeys = [
      'StoreBrand_ID',
      'Category',
      'Product Category',
      'ProductCategory',
      'category',
      'Product Sub Category',
      'ProductSubCategory',
      'productSubCategory',
      'subcategory',
      'Model Name',
      'ModelName',
      'modelName',
      'Plan Type',
      'PlanType',
      'planType'
    ];
    const dateMetrics: Record<string, any> = {};
    for (const key in remaining) {
      if (!metadataKeys.includes(key)) {
        dateMetrics[key] = remaining[key];
      }
    }

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
      if (!detectedYear) {
        detectedYear = parseInt(yyyy, 10);
      }
      if (!dailySalesByMonth[monthKey]) {
        dailySalesByMonth[monthKey] = [];
      }
      let entry = dailySalesByMonth[monthKey].find(e => e.date === date);
      if (!entry) {
        entry = { date };
        dailySalesByMonth[monthKey].push(entry);
      }
      if (/count of sales/i.test(metric)) entry.countOfSales = dateMetrics[key] || 0;
      if (/revenue/i.test(metric)) entry.revenue = dateMetrics[key] || 0;
    }

    if (!detectedYear) {
      return `❌ No valid daily sales metrics/dates detected. ${context}`;
    }

    // Return prepared daily sales record payload
    return JSON.stringify({
      success: true,
      data: {
        storeId: mapping.storeId,
        brandId: mapping.brandId,
        productCategoryId: category.id,
        productSubCategoryId,
        modelName: modelNameVal ? String(modelNameVal).trim() : 'N/A',
        planType,
        year: detectedYear,
        dailySales: dailySalesByMonth,
        context,
        successCount
      }
    });

  } catch (err) {
    console.error('Optimization error:', err);
    const { StoreBrand_ID } = rowObj;
    const categoryVal = rowObj['Product Category'] || rowObj.Category || rowObj.ProductCategory || rowObj.category;
    return `❌ Internal server error for StoreBrand_ID: ${StoreBrand_ID || 'N/A'}, Product Category: ${categoryVal || 'N/A'}`;
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
    productCategoryId: string;
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
            storeId_brandId_productCategoryId_productSubCategoryId_modelName_planType_year: {
              storeId: record.storeId,
              brandId: record.brandId,
              productCategoryId: record.productCategoryId,
              productSubCategoryId: 'subcat_na', // Default to N/A for monthly
              modelName: 'N/A', // Default to N/A for monthly
              planType: 'NA' as any, // Default to NA for monthly
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
              productCategoryId: record.productCategoryId,
              productSubCategoryId: 'subcat_na',
              modelName: 'N/A',
              planType: 'NA' as any,
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
    productCategoryId: string;
    productSubCategoryId: string;
    modelName: string;
    planType: any;
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
          storeId_brandId_productCategoryId_productSubCategoryId_modelName_planType_year: {
            storeId: record.storeId,
            brandId: record.brandId,
            productCategoryId: record.productCategoryId,
            productSubCategoryId: record.productSubCategoryId,
            modelName: record.modelName,
            planType: record.planType,
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
          update: {
            dailySales: mergedDaily,
            productSubCategoryId: record.productSubCategoryId,
            modelName: record.modelName,
            planType: record.planType,
          },
          create: {
            storeId: record.storeId,
            brandId: record.brandId,
            productCategoryId: record.productCategoryId,
            productSubCategoryId: record.productSubCategoryId,
            modelName: record.modelName,
            planType: record.planType,
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