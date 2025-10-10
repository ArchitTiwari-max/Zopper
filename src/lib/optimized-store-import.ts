import { PrismaClient, PartnerBrandType } from '@prisma/client';

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
interface StoreCacheData {
  executives: Map<string, { id: string; name: string }>; // executiveId -> executive data
  stores: Map<string, { id: string; storeName: string; currentExecutives: string[] }>; // storeId -> store data with executives
  brands: Map<string, { id: string; brandName: string }>; // brandId -> brand data
}

// Global cache - reused across requests
let globalStoreCache: StoreCacheData | null = null;

/**
 * Initialize cache with all reference data upfront
 * This eliminates 99% of database lookups during import
 */
export async function initializeStoreCache(prisma: PrismaClient): Promise<StoreCacheData> {
  if (globalStoreCache) {
    return globalStoreCache;
  }

  console.log('🔄 Initializing store import cache...');
  
  const [executives, stores, brands] = await Promise.all([
    prisma.executive.findMany({ select: { id: true, name: true } }),
    prisma.store.findMany({ 
      select: { 
        id: true, 
        storeName: true,
        executiveStores: { select: { executiveId: true } }
      } 
    }),
    prisma.brand.findMany({ select: { id: true, brandName: true } })
  ]);

  globalStoreCache = {
    executives: new Map(executives.map(e => [e.id, e])),
    stores: new Map(stores.map(s => [s.id, {
      id: s.id,
      storeName: s.storeName,
      currentExecutives: s.executiveStores.map(es => es.executiveId)
    }])),
    brands: new Map(brands.map(b => [b.id, b]))
  };

  console.log(`✅ Store cache initialized - ${executives.length} executives, ${stores.length} stores, ${brands.length} brands`);
  return globalStoreCache;
}

/**
 * Optimized store processing with batch operations and caching
 */
export async function optimizedProcessStore(rowObj: Record<string, any>, rowIndex: number, cache: StoreCacheData): Promise<string> {
  try {
    const storeId = rowObj.Store_ID?.toString().trim() || '';
    const storeName = rowObj['Store Name']?.toString().trim() || '';
    const city = rowObj.City?.toString().trim() || '';
    // Handle both partnerBrandIds and partneraBrandIds (common typo)
    const partnerBrandIdsString = (rowObj.partnerBrandIds || rowObj.partneraBrandIds)?.toString() || '';
    // New: accept partnerBrandTypes column to align with partnerBrandIds (comma-separated)
    const partnerBrandTypesString = (rowObj.partnerBrandTypes || rowObj.partnerBrandType || rowObj['PartnerBrandTypes'] || rowObj['Partner Brand Types'])?.toString() || '';
    const executiveIdsString = rowObj.Executive_IDs?.toString() || '';

    const context = `Store: ${storeId} | ${storeName} | ${city}`;

    // Validate required fields
    if (!storeId || !storeName) {
      return `❌ Missing Store_ID or Store Name. ${context}`;
    }

    // Parse partner brand IDs
    const partnerBrandIds = partnerBrandIdsString
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    // Parse partner brand types, if provided
    const rawTypes = partnerBrandTypesString
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    // Helper: map string to enum value
    const mapType = (val: string): PartnerBrandType | null => {
      const v = val.toUpperCase().replace(/\s+/g, '');
      if (v === 'A+' || v === 'A_PLUS') return PartnerBrandType.A_PLUS;
      if (v === 'A') return PartnerBrandType.A;
      if (v === 'B') return PartnerBrandType.B;
      if (v === 'C') return PartnerBrandType.C;
      if (v === 'D') return PartnerBrandType.D;
      return null;
    };

    // Validate partner brand IDs using cache
    for (const brandId of partnerBrandIds) {
      if (brandId && !cache.brands.has(brandId)) {
        return `❌ Brand ID '${brandId}' not found. ${context}`;
      }
    }

    // If types were provided, ensure length matches IDs and values are valid
    let partnerBrandTypes: PartnerBrandType[] | undefined = undefined;
    if (rawTypes.length > 0) {
      if (rawTypes.length !== partnerBrandIds.length) {
        return `❌ partnerBrandTypes count (${rawTypes.length}) does not match partnerBrandIds count (${partnerBrandIds.length}). ${context}`;
      }
      const mapped = rawTypes.map(mapType);
      if (mapped.some(m => m === null)) {
        return `❌ Invalid partnerBrandTypes value(s). Allowed: A+, A, B, C, D. ${context}`;
      }
      partnerBrandTypes = mapped as PartnerBrandType[];
    }

    // Parse executive IDs
    const executiveIds = executiveIdsString
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    // Validate executive IDs using cache
    for (const executiveId of executiveIds) {
      if (executiveId && !cache.executives.has(executiveId)) {
        return `❌ Executive ID '${executiveId}' not found. ${context}`;
      }
    }

    // Calculate executive changes for feedback
    const currentStore = cache.stores.get(storeId);
    const currentExecutives = currentStore?.currentExecutives || [];
    const newExecutives = executiveIds;
    
    const executivesToAdd = newExecutives.filter(id => !currentExecutives.includes(id));
    const executivesToRemove = currentExecutives.filter(id => !newExecutives.includes(id));

    // Update cache with new executive assignments
    cache.stores.set(storeId, {
      id: storeId,
      storeName,
      currentExecutives: newExecutives
    });

    // Return prepared data for batch processing
    return JSON.stringify({
      success: true,
      data: {
        storeId,
        storeName,
        city,
        fullAddress: '',
        partnerBrandIds,
        partnerBrandTypes, // may be undefined if column not provided
        executiveIds,
        executivesToAdd,
        executivesToRemove,
        context
      }
    });
    
  } catch (err) {
    console.error('Store processing error:', err);
    const storeId = rowObj.Store_ID?.toString() || 'N/A';
    const storeName = rowObj['Store Name']?.toString() || 'N/A';
    return `❌ Internal server error for Store: ${storeId} | ${storeName}`;
  }
}

/**
 * Batch process store records with executive assignments
 */
export async function batchProcessStoreRecords(
  validatedData: any[], 
  prisma: PrismaClient,
  onProgress?: (storeData: any, success: boolean, message: string) => void
): Promise<{ successful: number; failed: number; errors: string[]; totalExecutivesAdded: number; totalExecutivesRemoved: number; }> {
  console.log(`🔄 Starting batch processing for ${validatedData.length} stores...`);
  
  // Debug: Log first few stores to be processed
  console.log(`Debug: First store sample:`, validatedData[0]);

  let successful = 0;
  let failed = 0;
  let totalExecutivesAdded = 0;
  let totalExecutivesRemoved = 0;
  const errors: string[] = [];

  // Process stores in batches to avoid memory issues
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < validatedData.length; i += BATCH_SIZE) {
    const batch = validatedData.slice(i, i + BATCH_SIZE);
    
    console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validatedData.length / BATCH_SIZE)} (${batch.length} stores)...`);

    await Promise.all(batch.map(async (storeData) => {
      try {
        // Upsert store data (each operation is atomic)
        await prisma.store.upsert({
          where: { id: storeData.storeId },
          update: {
            storeName: storeData.storeName,
            city: storeData.city,
            fullAddress: storeData.fullAddress,
            partnerBrandIds: storeData.partnerBrandIds,
            // Only set types if provided; otherwise keep existing or set to empty when ids empty
            ...(storeData.partnerBrandTypes ? { partnerBrandTypes: storeData.partnerBrandTypes } : {})
          },
          create: {
            id: storeData.storeId,
            storeName: storeData.storeName,
            city: storeData.city,
            fullAddress: storeData.fullAddress,
            partnerBrandIds: storeData.partnerBrandIds,
            partnerBrandTypes: storeData.partnerBrandTypes ?? []
          }
        });

        // Remove old executive assignments
        if (storeData.executivesToRemove.length > 0) {
          await prisma.executiveStoreAssignment.deleteMany({
            where: {
              storeId: storeData.storeId,
              executiveId: { in: storeData.executivesToRemove }
            }
          });
        }

        // Add new executive assignments
        if (storeData.executivesToAdd.length > 0) {
          for (const executiveId of storeData.executivesToAdd) {
            await prisma.executiveStoreAssignment.upsert({
              where: {
                executiveId_storeId: {
                  executiveId: executiveId,
                  storeId: storeData.storeId
                }
              },
              update: {
                assignedAt: new Date()
              },
              create: {
                executiveId: executiveId,
                storeId: storeData.storeId,
                assignedAt: new Date()
              }
            });
          }
        }

        successful++;
        totalExecutivesAdded += storeData.executivesToAdd.length;
        totalExecutivesRemoved += storeData.executivesToRemove.length;
        
        // Notify frontend of successful database write
        onProgress?.(storeData, true, `Store and ${storeData.executivesToAdd.length + storeData.executivesToRemove.length} executive assignments updated successfully`);
        
        console.log(`✅ Successfully processed: ${storeData.context}`);
        console.log(`   └─ Executives added: ${storeData.executivesToAdd.length}, removed: ${storeData.executivesToRemove.length}`);

      } catch (error) {
        failed++;
        const errorMessage = `${storeData.context}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        
        // Notify frontend of failed database write
        onProgress?.(storeData, false, `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        console.error(`❌ Store processing failed: ${errorMessage}`);
        console.error(`Debug: Full error object:`, error);
        console.error(`Debug: Store data that failed:`, storeData);
      }
    }));
  }

  console.log(`✅ Batch processing complete: ${successful} successful, ${failed} failed`);

  return {
    successful,
    failed,
    errors,
    totalExecutivesAdded,
    totalExecutivesRemoved
  };
}

/**
 * Close Prisma connection
 */
export async function closePrismaConnection(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
  // Clear cache when disconnecting
  globalStoreCache = null;
}