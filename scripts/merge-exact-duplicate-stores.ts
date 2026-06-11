import { PrismaClient, PartnerBrandType } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();

// Noise words to ignore during token comparisons
const noiseWords = new Set([
  "br", "branch", "up", "sales", "co", "company", "pvt", "ltd", "limited",
  "and", "of", "the", "in", "at", "with", "on", "for", "to", "a", "an", "by",
  "ms", "m", "s", "electronics", "electrical", "electricals", "electro",
  "appliances", "home", "store", "stores", "showroom", "agency", "agencies",
  "enterprise", "enterprises", "retail", "retailer", "retailers", "distributor",
  "distributors", "trader", "traders", "trading", "associate", "associates",
  "centre", "center", "services", "service", "world", "zone"
]);

// Simple Levenshtein distance
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return dp[m][n];
}

// Normalize strings for token comparisons and replacements
function normalizeStoreName(name: string): string {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bvs\b/g, "vijay sales")
    .replace(/\brdc\b/g, "raj nagar dc")
    .replace(/\brd\b/g, "reliance digital")
    .replace(/\belectroworld\b/g, "electro world")
    .replace(/\bindrapuram\b/g, "indirapuram")
    .replace(/\bsec\b/g, "sector")
    .replace(/\bsect\b/g, "sector")
    .replace(/\bghazibad\b/g, "ghaziabad")
    .replace(/\bbareily\b/g, "bareilly")
    .replace(/\bgurgaon\b/g, "gurugram")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Simple normalization for city name
function normalizeCity(city: string): string {
  if (!city) return "";
  return city.toLowerCase()
    .replace(/\s+/g, "")
    .replace("ghazibad", "ghaziabad")
    .replace("bareily", "bareilly")
    .replace("gurgaon", "gurugram")
    .trim();
}

// Helper to merge monthly sales JSON
function mergeMonthlySales(salesO: any, salesD: any): any[] {
  const arrO = Array.isArray(salesO) ? salesO : [];
  const arrD = Array.isArray(salesD) ? salesD : [];
  
  const mergedMap = new Map<number, any>();
  
  const addData = (item: any) => {
    const month = Number(item.month);
    if (isNaN(month)) return;
    
    if (!mergedMap.has(month)) {
      mergedMap.set(month, {
        month,
        deviceSales: Number(item.deviceSales || 0),
        planSales: Number(item.planSales || 0),
        revenue: Number(item.revenue || 0),
      });
    } else {
      const existing = mergedMap.get(month);
      existing.deviceSales += Number(item.deviceSales || 0);
      existing.planSales += Number(item.planSales || 0);
      existing.revenue += Number(item.revenue || 0);
    }
  };
  
  arrO.forEach(addData);
  arrD.forEach(addData);
  
  const mergedList = Array.from(mergedMap.values()).map(item => {
    const attachPct = item.deviceSales > 0 ? (item.planSales / item.deviceSales) * 100 : 0;
    return {
      ...item,
      attachPct: Math.round(attachPct * 100) / 100,
    };
  }).sort((a, b) => a.month - b.month);
  
  return mergedList;
}

// Helper to merge daily sales JSON
function mergeDailySales(dailyO: any, dailyD: any): any {
  const objO = dailyO && typeof dailyO === "object" ? dailyO : {};
  const objD = dailyD && typeof dailyD === "object" ? dailyD : {};
  
  const merged: any = {};
  const allMonths = new Set([...Object.keys(objO), ...Object.keys(objD)]);
  
  for (const month of allMonths) {
    const arrO = Array.isArray(objO[month]) ? objO[month] : [];
    const arrD = Array.isArray(objD[month]) ? objD[month] : [];
    
    const dateMap = new Map<string, any>();
    
    const addDailyData = (item: any) => {
      const date = String(item.date || "");
      if (!date) return;
      
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          planSales: Number(item.planSales || 0),
          revenue: Number(item.revenue || 0),
        });
      } else {
        const existing = dateMap.get(date);
        existing.planSales += Number(item.planSales || 0);
        existing.revenue += Number(item.revenue || 0);
      }
    };
    
    arrO.forEach(addDailyData);
    arrD.forEach(addDailyData);
    
    merged[month] = Array.from(dateMap.values());
  }
  
  return merged;
}

async function run() {
  try {
    console.log("🚀 Starting Exact Duplicate Store Merger...");
    console.log("📡 Fetching all stores from database...");

    const stores = await prisma.store.findMany({
      include: {
        _count: {
          select: {
            visits: true,
            digitalVisits: true,
            salesRecords: true,
            executiveStores: true,
          }
        }
      }
    });

    console.log(`✅ Fetched ${stores.length} stores.`);

    if (stores.length === 0) {
      console.log("⚠️ No stores found in the database.");
      return;
    }

    // Map to include activity scores and individual counts
    const mappedStores = stores.map(store => {
      const visits = store._count.visits;
      const digitalVisits = store._count.digitalVisits;
      const salesRecords = store._count.salesRecords;
      const assignments = store._count.executiveStores;
      const activityScore = visits + digitalVisits + salesRecords + assignments;
      
      return {
        id: store.id,
        storeName: store.storeName,
        city: store.city || "",
        fullAddress: store.fullAddress || "",
        partnerBrandIds: store.partnerBrandIds || [],
        partnerBrandTypes: store.partnerBrandTypes || [],
        storeType: store.storeType || null,
        storeChannel: store.storeChannel || null,
        cityTier: store.cityTier || null,
        state: store.state || null,
        priority: store.priority || null,
        visits,
        digitalVisits,
        salesRecords,
        assignments,
        activityScore,
      };
    });

    // Sort by activity score descending, and then by ID alphabetically
    mappedStores.sort((a, b) => {
      if (b.activityScore !== a.activityScore) {
        return b.activityScore - a.activityScore;
      }
      return a.id.localeCompare(b.id);
    });

    const duplicateIds = new Set<string>();
    const mergePairs: { original: typeof mappedStores[0]; duplicate: typeof mappedStores[0] }[] = [];

    // Identify only "Exact Name & City Match" duplicates
    for (let i = 0; i < mappedStores.length; i++) {
      const storeA = mappedStores[i];
      if (duplicateIds.has(storeA.id)) {
        continue;
      }

      for (let j = i + 1; j < mappedStores.length; j++) {
        const storeB = mappedStores[j];
        if (duplicateIds.has(storeB.id)) {
          continue;
        }

        const nameA = cleanString(normalizeStoreName(storeA.storeName));
        const nameB = cleanString(normalizeStoreName(storeB.storeName));
        
        const cityA = normalizeCity(storeA.city);
        const cityB = normalizeCity(storeB.city);

        if (nameA === nameB && nameA.length > 0 && cityA === cityB) {
          duplicateIds.add(storeB.id);
          mergePairs.push({ original: storeA, duplicate: storeB });
        }
      }
    }

    console.log(`📊 Found ${mergePairs.length} exact (Name & City) duplicate stores to merge.`);

    if (mergePairs.length === 0) {
      console.log("🎉 No exact duplicates found to merge!");
      return;
    }

    let mergedCount = 0;

    for (const { original: O, duplicate: D } of mergePairs) {
      console.log(`\n🔄 Merging duplicate [${D.storeName} (ID: ${D.id})] into original [${O.storeName} (ID: ${O.id})]...`);

      // 1. Merge basic store details of D into O (if missing in O)
      const updateData: any = {};
      if (!O.fullAddress && D.fullAddress) updateData.fullAddress = D.fullAddress;
      if (!O.storeType && D.storeType) updateData.storeType = D.storeType;
      if (!O.storeChannel && D.storeChannel) updateData.storeChannel = D.storeChannel;
      if (!O.cityTier && D.cityTier) updateData.cityTier = D.cityTier;
      if (!O.state && D.state) updateData.state = D.state;
      if (!O.priority && D.priority) updateData.priority = D.priority;

      // Merge brand relations
      const mergedBrandIds = [...O.partnerBrandIds];
      const mergedBrandTypes = [...O.partnerBrandTypes];
      for (let idx = 0; idx < D.partnerBrandIds.length; idx++) {
        const bId = D.partnerBrandIds[idx];
        let bType = D.partnerBrandTypes[idx];
        if (!bType || !Object.values(PartnerBrandType).includes(bType as any)) {
          bType = PartnerBrandType.D;
        }
        if (!mergedBrandIds.includes(bId)) {
          mergedBrandIds.push(bId);
          mergedBrandTypes.push(bType);
        }
      }

      if (mergedBrandIds.length !== O.partnerBrandIds.length) {
        updateData.partnerBrandIds = mergedBrandIds;
        updateData.partnerBrandTypes = mergedBrandTypes;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.store.update({
          where: { id: O.id },
          data: updateData,
        });
        console.log(`   ✅ Merged store metadata and brands into original store.`);
      }

      // 2. Update simple references (no unique constraints)
      
      // Visits
      const visitsUpdate = await prisma.visit.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (visitsUpdate.count > 0) {
        console.log(`   ✅ Updated ${visitsUpdate.count} physical visits to original store.`);
      }

      // Digital Visits
      const digitalVisitsUpdate = await prisma.digitalVisit.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (digitalVisitsUpdate.count > 0) {
        console.log(`   ✅ Updated ${digitalVisitsUpdate.count} digital visits to original store.`);
      }

      // Admin Visits
      const adminVisitsUpdate = await prisma.adminVisit.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (adminVisitsUpdate.count > 0) {
        console.log(`   ✅ Updated ${adminVisitsUpdate.count} admin visits to original store.`);
      }

      // Holiday Requests
      const holidayRequestsUpdate = await prisma.holidayRequest.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (holidayRequestsUpdate.count > 0) {
        console.log(`   ✅ Updated ${holidayRequestsUpdate.count} holiday requests to original store.`);
      }

      // 3. Update complex references (with unique constraints or array columns)

      // Store Alignment (Unique on storeId)
      const alignmentD = await prisma.storeAlignment.findUnique({
        where: { storeId: D.id },
      });
      if (alignmentD) {
        const alignmentO = await prisma.storeAlignment.findUnique({
          where: { storeId: O.id },
        });

        if (alignmentO) {
          // Merge JSON objects
          const mergedStoreLevel = {
            ...(alignmentD.storeLevel && typeof alignmentD.storeLevel === "object" ? alignmentD.storeLevel : {}),
            ...(alignmentO.storeLevel && typeof alignmentO.storeLevel === "object" ? alignmentO.storeLevel : {}),
          };
          const mergedStakeholderLevel = {
            ...(alignmentD.stakeholderLevel && typeof alignmentD.stakeholderLevel === "object" ? alignmentD.stakeholderLevel : {}),
            ...(alignmentO.stakeholderLevel && typeof alignmentO.stakeholderLevel === "object" ? alignmentO.stakeholderLevel : {}),
          };

          await prisma.storeAlignment.update({
            where: { storeId: O.id },
            data: {
              storeLevel: mergedStoreLevel,
              stakeholderLevel: mergedStakeholderLevel,
            },
          });
          await prisma.storeAlignment.delete({
            where: { storeId: D.id },
          });
          console.log(`   ✅ Merged and updated store alignments.`);
        } else {
          // Transfer alignment from D to O
          await prisma.storeAlignment.update({
            where: { id: alignmentD.id },
            data: { storeId: O.id },
          });
          console.log(`   ✅ Transferred store alignment to original store.`);
        }
      }

      // Executive Store Assignments (Unique on [executiveId, storeId])
      const assignmentsD = await prisma.executiveStoreAssignment.findMany({
        where: { storeId: D.id },
      });
      for (const assignD of assignmentsD) {
        const assignO = await prisma.executiveStoreAssignment.findUnique({
          where: {
            executiveId_storeId: {
              executiveId: assignD.executiveId,
              storeId: O.id,
            }
          }
        });

        if (assignO) {
          // Conflict: executive is assigned to both. Merge status and delete D's assignment.
          if (assignD.isFlagged && !assignO.isFlagged) {
            await prisma.executiveStoreAssignment.update({
              where: { id: assignO.id },
              data: { isFlagged: true },
            });
          }
          await prisma.executiveStoreAssignment.delete({
            where: { id: assignD.id },
          });
        } else {
          // No conflict: update storeId
          await prisma.executiveStoreAssignment.update({
            where: { id: assignD.id },
            data: { storeId: O.id },
          });
        }
      }
      if (assignmentsD.length > 0) {
        console.log(`   ✅ Processed ${assignmentsD.length} executive assignments.`);
      }

      // Store Targets (Unique on [storeId, month, year])
      const targetsD = await prisma.storeTarget.findMany({
        where: { storeId: D.id },
      });
      for (const targetD of targetsD) {
        const targetO = await prisma.storeTarget.findUnique({
          where: {
            storeId_month_year: {
              storeId: O.id,
              month: targetD.month,
              year: targetD.year,
            }
          }
        });

        if (targetO) {
          // Merge: use max target values to be safe and delete D's target
          const updatedRevenue = Math.max(targetO.targetRevenue || 0, targetD.targetRevenue || 0);
          const updatedUnits = Math.max(targetO.targetUnits || 0, targetD.targetUnits || 0);

          await prisma.storeTarget.update({
            where: { id: targetO.id },
            data: {
              targetRevenue: updatedRevenue > 0 ? updatedRevenue : null,
              targetUnits: updatedUnits > 0 ? updatedUnits : null,
            }
          });
          await prisma.storeTarget.delete({
            where: { id: targetD.id },
          });
        } else {
          // No conflict: update storeId
          await prisma.storeTarget.update({
            where: { id: targetD.id },
            data: { storeId: O.id },
          });
        }
      }
      if (targetsD.length > 0) {
        console.log(`   ✅ Processed ${targetsD.length} store target records.`);
      }

      // Sales Records (Unique on [storeId, brandId, categoryId, year])
      const salesD = await prisma.salesRecord.findMany({
        where: { storeId: D.id },
      });
      for (const recD of salesD) {
        const recO = await prisma.salesRecord.findUnique({
          where: {
            storeId_brandId_categoryId_year: {
              storeId: O.id,
              brandId: recD.brandId,
              categoryId: recD.categoryId,
              year: recD.year,
            }
          }
        });

        if (recO) {
          // Conflict: merge JSON objects and delete D's record
          const mergedMonthly = mergeMonthlySales(recO.monthlySales, recD.monthlySales);
          const mergedDaily = mergeDailySales(recO.dailySales, recD.dailySales);

          await prisma.salesRecord.update({
            where: { id: recO.id },
            data: {
              monthlySales: mergedMonthly,
              dailySales: mergedDaily,
            }
          });
          await prisma.salesRecord.delete({
            where: { id: recD.id },
          });
        } else {
          // No conflict: update storeId
          await prisma.salesRecord.update({
            where: { id: recD.id },
            data: { storeId: O.id },
          });
        }
      }
      if (salesD.length > 0) {
        console.log(`   ✅ Processed & merged ${salesD.length} sales records.`);
      }

      // Visit Plans (storeIds String[])
      const plansD = await prisma.visitPlan.findMany({
        where: {
          storeIds: {
            has: D.id,
          }
        }
      });
      for (const plan of plansD) {
        // Replace D.id with O.id in storeIds array and filter out duplicate IDs
        const updatedStoreIds = plan.storeIds.map(id => id === D.id ? O.id : id);
        const uniqueStoreIds = Array.from(new Set(updatedStoreIds));

        await prisma.visitPlan.update({
          where: { id: plan.id },
          data: {
            storeIds: uniqueStoreIds,
          }
        });
      }
      if (plansD.length > 0) {
        console.log(`   ✅ Updated ${plansD.length} visit plans containing duplicate store.`);
      }

      // StoreChainConfig (excludedStoreIds String[])
      const chainConfigs = await prisma.storeChainConfig.findMany({
        where: {
          excludedStoreIds: {
            has: D.id,
          }
        }
      });
      for (const config of chainConfigs) {
        const updatedExcludes = config.excludedStoreIds.map(id => id === D.id ? O.id : id);
        const uniqueExcludes = Array.from(new Set(updatedExcludes));

        await prisma.storeChainConfig.update({
          where: { id: config.id },
          data: {
            excludedStoreIds: uniqueExcludes,
          }
        });
      }
      if (chainConfigs.length > 0) {
        console.log(`   ✅ Updated ${chainConfigs.length} store chain configs.`);
      }

      // 4. Finally, delete the duplicate Store record
      await prisma.store.delete({
        where: { id: D.id },
      });
      console.log(`   🗑️  Deleted duplicate store [${D.storeName} (ID: ${D.id})] from Store collection.`);
      
      mergedCount++;
    }

    console.log(`\n🎉 Successfully merged all ${mergedCount} exact duplicate stores!`);

    // 5. Export final list of stores to Excel
    console.log("\n📡 Querying final stores in database for export...");
    const finalStores = await prisma.store.findMany();
    console.log(`✅ Database currently has ${finalStores.length} stores.`);

    const excelData = finalStores.map(store => ({
      "Store ID": store.id,
      "Store Name": store.storeName,
      "City": store.city,
      "Full Address": store.fullAddress || "",
      "Latitude": store.latitude || "",
      "Longitude": store.longitude || "",
      "Partner Brand IDs": store.partnerBrandIds?.join(", ") || "",
      "Partner Brand Types": store.partnerBrandTypes?.join(", ") || "",
      "Store Type": store.storeType || "",
      "Store Channel": store.storeChannel || "",
      "City Tier": store.cityTier || "",
      "State": store.state || "",
      "Priority": store.priority || "",
    }));

    const filename = "final_stores_export.xlsx";
    const filepath = path.join(process.cwd(), filename);
    console.log(`📁 Saving final stores list to ${filename}...`);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-fit column widths
    if (excelData.length > 0) {
      const maxWidth = 55;
      const colWidths = Object.keys(excelData[0]).map(key => ({
        wch: Math.min(
          Math.max(
            key.length,
            ...excelData.map(row => String(row[key] || "").length)
          ),
          maxWidth
        )
      }));
      worksheet["!cols"] = colWidths;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Stores");
    XLSX.writeFile(workbook, filepath);

    console.log(`\n🎉 Final Store Export Completed Successfully!`);
    console.log(`   📁 File saved: ${filepath}`);
    console.log(`   📊 Total Stores: ${finalStores.length}`);

  } catch (err) {
    console.error("❌ An error occurred during database merge:", err);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Disconnected from database.");
  }
}

run();
