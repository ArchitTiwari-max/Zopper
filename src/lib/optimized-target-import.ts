import { PrismaClient } from "@prisma/client";

let prismaInstance: PrismaClient | null = null;

export function getPrismaInstance(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prismaInstance;
}

export interface TargetCacheData {
  stores: Map<string, { id: string; storeBrands: { brandId: string }[] }>;
  brands: Map<string, { id: string; brandName: string }>;
  brandsByName: Map<string, { id: string; brandName: string }>;
  storeBrandsById: Map<string, { storeId: string; brandId: string }>;
}

let globalTargetCache: TargetCacheData | null = null;

/**
 * Initialize cache with stores and brands reference data.
 * Drastically speeds up lookups during large file imports.
 */
export async function initializeTargetCache(
  prisma: PrismaClient,
): Promise<TargetCacheData> {
  if (globalTargetCache) {
    return globalTargetCache;
  }

  console.log("🔄 Initializing reference cache for targets...");

  const [stores, brands, storeBrands] = await Promise.all([
    prisma.store.findMany({
      select: {
        id: true,
        storeBrands: {
          select: { brandId: true },
        },
      },
    }),
    prisma.brand.findMany({ select: { id: true, brandName: true } }),
    prisma.storeBrand.findMany({
      where: { storeBrandId: { not: null } },
      select: { storeBrandId: true, storeId: true, brandId: true },
    }),
  ]);

  globalTargetCache = {
    stores: new Map(stores.map((s) => [s.id.toUpperCase().trim(), s])),
    brands: new Map(brands.map((b) => [b.id.toUpperCase().trim(), b])),
    brandsByName: new Map(
      brands.map((b) => [b.brandName.toUpperCase().trim(), b]),
    ),
    storeBrandsById: new Map(
      storeBrands
        .filter((sb) => sb.storeBrandId)
        .map((sb) => [
          (sb.storeBrandId as string).toUpperCase().trim(),
          { storeId: sb.storeId, brandId: sb.brandId },
        ]),
    ),
  };

  console.log(
    `✅ Target reference cache initialized - ${stores.length} stores, ${brands.length} brands, ${storeBrands.length} mappings`,
  );
  return globalTargetCache;
}

function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30 + serial));
}

function extractDateInfo(val: unknown): { month: number; year: number } | null {
  if (val === undefined || val === null) return null;

  if (val instanceof Date) {
    return {
      month: val.getMonth() + 1,
      year: val.getFullYear(),
    };
  }

  if (typeof val === "number" && val >= 30000 && val <= 80000) {
    const d = excelSerialToDate(val);
    return {
      month: d.getUTCMonth() + 1,
      year: d.getUTCFullYear(),
    };
  }

  if (typeof val === "string") {
    const str = val.trim();

    const num = Number(str);
    if (!Number.isNaN(num) && num >= 30000 && num <= 80000) {
      const d = excelSerialToDate(num);
      return {
        month: d.getUTCMonth() + 1,
        year: d.getUTCFullYear(),
      };
    }

    let match = str.match(/^([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4})$/);
    if (match) {
      const [_, _dd, mm, yyyy] = match;
      return {
        month: parseInt(mm, 10),
        year: parseInt(yyyy, 10),
      };
    }

    match = str.match(/^([0-9]{4})[/-]([0-9]{1,2})[/-]([0-9]{1,2})$/);
    if (match) {
      const [_, yyyy, mm, _dd] = match;
      return {
        month: parseInt(mm, 10),
        year: parseInt(yyyy, 10),
      };
    }
  }

  return null;
}

/**
 * Robust month parsing to map text months (e.g. June, Jun) or numbers to 1-12.
 */
export function parseMonth(monthVal: unknown): number | null {
  if (monthVal === undefined || monthVal === null) return null;

  const dateInfo = extractDateInfo(monthVal);
  if (dateInfo) {
    return dateInfo.month;
  }

  if (typeof monthVal === "number") {
    if (monthVal >= 1 && monthVal <= 12) return monthVal;
    return null;
  }

  const str = String(monthVal).trim().toLowerCase();
  const num = parseInt(str, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= 12) {
    return num;
  }

  const monthsMap: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    september: 9,
    sept: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  return monthsMap[str] || null;
}

/**
 * Searches row object for possible key variations (case/space insensitive)
 */
export function getRowValue(
  rowObj: Record<string, unknown>,
  possibleKeys: string[],
): unknown {
  for (const pk of possibleKeys) {
    if (rowObj[pk] !== undefined) return rowObj[pk];

    const normalizedPk = pk.toLowerCase().replace(/[\s_-]/g, "");
    for (const key of Object.keys(rowObj)) {
      if (key.toLowerCase().replace(/[\s_-]/g, "") === normalizedPk) {
        return rowObj[key];
      }
    }
  }
  return undefined;
}

/**
 * Optimized target validation logic (uses cache instead of database hits).
 */
export async function optimizedPostTarget(
  rowObj: Record<string, unknown>,
  targetCount: number,
  cache: TargetCacheData,
): Promise<string> {
  try {
    const storeBrandIdVal = getRowValue(rowObj, [
      "StoreBrand_ID",
      "StoreBrand ID",
      "storeBrandId",
      "store_brand_id",
      "StoreBrand",
    ]);
    const monthVal = getRowValue(rowObj, ["Month", "month"]);
    const yearVal = getRowValue(rowObj, ["Year", "year"]);
    const targetRevenueVal = getRowValue(rowObj, [
      "Target_Revenue",
      "Target Revenue",
      "targetRevenue",
      "target_revenue",
      "Revenue",
      "target_sales",
    ]);
    const targetUnitsVal = getRowValue(rowObj, [
      "Target_Units",
      "Target Units",
      "targetUnits",
      "target_units",
      "Units",
      "target_quantity",
    ]);

    const storeBrandId = storeBrandIdVal ? String(storeBrandIdVal).trim() : "";
    const month = parseMonth(monthVal);
    let year = yearVal ? parseInt(String(yearVal).trim(), 10) : null;

    if (year === null || Number.isNaN(year) || year < 2000 || year > 2100) {
      const monthDateInfo = extractDateInfo(monthVal);
      if (monthDateInfo) {
        year = monthDateInfo.year;
      }
    }

    if (year === null || Number.isNaN(year) || year < 2000 || year > 2100) {
      const yearDateInfo = extractDateInfo(yearVal);
      if (yearDateInfo) {
        year = yearDateInfo.year;
      }
    }

    const context = `StoreBrand_ID: ${storeBrandId || "N/A"}, Month: ${monthVal || "N/A"}, Year: ${yearVal || "N/A"}`;

    if (!storeBrandId) return `❌ Missing StoreBrand_ID. ${context}`;
    if (month === null) return `❌ Invalid or missing Month. ${context}`;
    if (year === null || Number.isNaN(year) || year < 2000 || year > 2100)
      return `❌ Invalid or missing Year. ${context}`;

    // StoreBrand ID resolution
    const mapping = cache.storeBrandsById.get(storeBrandId.toUpperCase());
    if (!mapping)
      return `❌ StoreBrand_ID "${storeBrandId}" not found in database. ${context}`;

    const { storeId, brandId } = mapping;

    // Parse values
    let targetRevenue: number | null = null;
    if (
      targetRevenueVal !== undefined &&
      targetRevenueVal !== null &&
      targetRevenueVal !== ""
    ) {
      const cleanVal = String(targetRevenueVal).replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleanVal);
      if (!Number.isNaN(parsed)) targetRevenue = parsed;
    }

    let targetUnits: number | null = null;
    if (
      targetUnitsVal !== undefined &&
      targetUnitsVal !== null &&
      targetUnitsVal !== ""
    ) {
      const cleanVal = String(targetUnitsVal).replace(/[^0-9]/g, "");
      const parsed = parseInt(cleanVal, 10);
      if (!Number.isNaN(parsed)) targetUnits = parsed;
    }

    if (targetRevenue === null && targetUnits === null) {
      return `❌ Both Target Revenue and Target Units are missing or invalid. ${context}`;
    }

    return JSON.stringify({
      success: true,
      data: {
        storeId,
        brandId,
        month,
        year,
        targetRevenue,
        targetUnits,
        context,
        targetCount,
      },
    });
  } catch (err) {
    console.error("Target processing row exception:", err);
    return `❌ Exception processing row: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Concurrent batch upserting for targets
 */
export async function batchProcessTargetRecords(
  targetData: Array<{
    storeId: string;
    brandId: string;
    month: number;
    year: number;
    targetRevenue: number | null;
    targetUnits: number | null;
    context: string;
  }>,
  chunkSize = 50,
): Promise<{ successful: number; failed: number; errors: string[] }> {
  const prisma = getPrismaInstance();
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < targetData.length; i += chunkSize) {
    const chunk = targetData.slice(i, i + chunkSize);

    try {
      const operations = chunk.map(async (record) => {
        await prisma.storeTarget.upsert({
          where: {
            storeId_brandId_month_year: {
              storeId: record.storeId,
              brandId: record.brandId,
              month: record.month,
              year: record.year,
            },
          },
          update: {
            targetRevenue: record.targetRevenue,
            targetUnits: record.targetUnits,
          },
          create: {
            storeId: record.storeId,
            brandId: record.brandId,
            month: record.month,
            year: record.year,
            targetRevenue: record.targetRevenue,
            targetUnits: record.targetUnits,
          },
        });
      });

      await Promise.all(operations);
      successful += chunk.length;
    } catch (error) {
      failed += chunk.length;
      const errorMsg = `❌ Batch database write failure for chunk ${i}-${i + chunkSize}: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  return { successful, failed, errors };
}

export async function closePrismaConnection() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    globalTargetCache = null;
  }
}
