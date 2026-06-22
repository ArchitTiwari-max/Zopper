import { PartnerBrandType, PrismaClient } from "@prisma/client";
import * as path from "path";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

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

  const mergedList = Array.from(mergedMap.values())
    .map((item) => {
      const attachPct =
        item.deviceSales > 0 ? (item.planSales / item.deviceSales) * 100 : 0;
      return {
        ...item,
        attachPct: Math.round(attachPct * 100) / 100,
      };
    })
    .sort((a, b) => a.month - b.month);

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
    console.log("🚀 Starting Selected Duplicate Store Merger...");

    const excelPath = path.join(process.cwd(), "duplicate_stores_report.xlsx");
    console.log(`📡 Loading Excel file from: ${excelPath}`);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✅ Loaded ${rows.length} rows from Excel sheet.`);

    const mergePairs: { originalId: string; duplicateId: string }[] = [];

    // Parse columns case-insensitively to find rows where Action === "Merge"
    for (const row of rows) {
      let actionValue = "";
      let duplicateId = "";
      let originalId = "";

      for (const key of Object.keys(row)) {
        const normKey = key.toLowerCase().replace(/\s+/g, "");
        if (normKey === "action") {
          actionValue = String(row[key]).trim();
        } else if (normKey === "storeid") {
          duplicateId = String(row[key]).trim();
        } else if (normKey === "originalstoreid") {
          originalId = String(row[key]).trim();
        }
      }

      if (actionValue.toLowerCase() === "merge" && duplicateId && originalId) {
        mergePairs.push({ originalId, duplicateId });
      }
    }

    console.log(
      `📊 Found ${mergePairs.length} store pairs marked for "Merge" in the spreadsheet.`,
    );

    if (mergePairs.length === 0) {
      console.log("⚠️ No rows had 'Merge' in the Action column. Nothing to do.");
      return;
    }

    let mergedCount = 0;

    for (const { originalId, duplicateId } of mergePairs) {
      // Fetch both store records from database
      const O = await prisma.store.findUnique({ where: { id: originalId } });
      const D = await prisma.store.findUnique({ where: { id: duplicateId } });

      if (!O) {
        console.error(
          `❌ Original store with ID ${originalId} does not exist. Skipping merge for duplicate ID ${duplicateId}.`,
        );
        continue;
      }
      if (!D) {
        console.warn(
          `⚠️ Duplicate store with ID ${duplicateId} does not exist in database (already deleted or merged). Skipping.`,
        );
        continue;
      }

      console.log(
        `\n🔄 Merging duplicate [${D.storeName} (ID: ${D.id})] into original [${O.storeName} (ID: ${O.id})]...`,
      );

      // 1. Merge basic store details of D into O (if missing in O)
      const updateData: any = {};
      if (!O.fullAddress && D.fullAddress)
        updateData.fullAddress = D.fullAddress;
      if (!O.storeType && D.storeType) updateData.storeType = D.storeType;
      if (!O.storeChannel && D.storeChannel)
        updateData.storeChannel = D.storeChannel;
      if (!O.cityTier && D.cityTier) updateData.cityTier = D.cityTier;
      if (!O.state && D.state) updateData.state = D.state;
      if (!O.priority && D.priority) updateData.priority = D.priority;

      // Merge brand relations
      const originalBrandIds = O.partnerBrandIds || [];
      const originalBrandTypes = O.partnerBrandTypes || [];
      const duplicateBrandIds = D.partnerBrandIds || [];
      const duplicateBrandTypes = D.partnerBrandTypes || [];

      const mergedBrandIds = [...originalBrandIds];
      const mergedBrandTypes = [...originalBrandTypes];
      for (let idx = 0; idx < duplicateBrandIds.length; idx++) {
        const bId = duplicateBrandIds[idx];
        let bType = duplicateBrandTypes[idx];
        if (!bType || !Object.values(PartnerBrandType).includes(bType as any)) {
          bType = PartnerBrandType.D;
        }
        if (!mergedBrandIds.includes(bId)) {
          mergedBrandIds.push(bId);
          mergedBrandTypes.push(bType);
        }
      }

      if (mergedBrandIds.length !== originalBrandIds.length) {
        updateData.partnerBrandIds = mergedBrandIds;
        updateData.partnerBrandTypes = mergedBrandTypes;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.store.update({
          where: { id: O.id },
          data: updateData,
        });
        console.log(
          `   ✅ Merged store metadata and brands into original store.`,
        );
      }

      // 2. Update simple references (no unique constraints)

      // Visits
      const visitsUpdate = await prisma.visit.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (visitsUpdate.count > 0) {
        console.log(
          `   ✅ Updated ${visitsUpdate.count} physical visits to original store.`,
        );
      }

      // Digital Visits
      const digitalVisitsUpdate = await prisma.digitalVisit.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (digitalVisitsUpdate.count > 0) {
        console.log(
          `   ✅ Updated ${digitalVisitsUpdate.count} digital visits to original store.`,
        );
      }

      // Admin Visits
      const adminVisitsUpdate = await prisma.adminVisit.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (adminVisitsUpdate.count > 0) {
        console.log(
          `   ✅ Updated ${adminVisitsUpdate.count} admin visits to original store.`,
        );
      }

      // Holiday Requests
      const holidayRequestsUpdate = await prisma.holidayRequest.updateMany({
        where: { storeId: D.id },
        data: { storeId: O.id },
      });
      if (holidayRequestsUpdate.count > 0) {
        console.log(
          `   ✅ Updated ${holidayRequestsUpdate.count} holiday requests to original store.`,
        );
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
            ...(alignmentD.storeLevel &&
            typeof alignmentD.storeLevel === "object"
              ? alignmentD.storeLevel
              : {}),
            ...(alignmentO.storeLevel &&
            typeof alignmentO.storeLevel === "object"
              ? alignmentO.storeLevel
              : {}),
          };
          const mergedStakeholderLevel = {
            ...(alignmentD.stakeholderLevel &&
            typeof alignmentD.stakeholderLevel === "object"
              ? alignmentD.stakeholderLevel
              : {}),
            ...(alignmentO.stakeholderLevel &&
            typeof alignmentO.stakeholderLevel === "object"
              ? alignmentO.stakeholderLevel
              : {}),
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
            },
          },
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
        console.log(
          `   ✅ Processed ${assignmentsD.length} executive assignments.`,
        );
      }

      // Store Targets (Unique on [storeId, month, year])
      const targetsD = await prisma.storeTarget.findMany({
        where: { storeId: D.id },
      });
      for (const targetD of targetsD) {
        const targetO = await prisma.storeTarget.findUnique({
          where: {
            storeId_brandId_month_year: {
              storeId: O.id,
              brandId: targetD.brandId,
              month: targetD.month,
              year: targetD.year,
            },
          },
        });

        if (targetO) {
          // Merge: use max target values to be safe and delete D's target
          const updatedRevenue = Math.max(
            targetO.targetRevenue || 0,
            targetD.targetRevenue || 0,
          );
          const updatedUnits = Math.max(
            targetO.targetUnits || 0,
            targetD.targetUnits || 0,
          );

          await prisma.storeTarget.update({
            where: { id: targetO.id },
            data: {
              targetRevenue: updatedRevenue > 0 ? updatedRevenue : null,
              targetUnits: updatedUnits > 0 ? updatedUnits : null,
            },
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
            storeId_brandId_productCategoryId_year: {
              storeId: O.id,
              brandId: recD.brandId,
              productCategoryId: recD.productCategoryId,
              year: recD.year,
            },
          },
        });

        if (recO) {
          // Conflict: merge JSON objects and delete D's record
          const mergedMonthly = mergeMonthlySales(
            recO.monthlySales,
            recD.monthlySales,
          );
          const mergedDaily = mergeDailySales(recO.dailySales, recD.dailySales);

          await prisma.salesRecord.update({
            where: { id: recO.id },
            data: {
              monthlySales: mergedMonthly,
              dailySales: mergedDaily,
            },
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
          },
        },
      });
      for (const plan of plansD) {
        // Replace D.id with O.id in storeIds array and filter out duplicate IDs
        const updatedStoreIds = plan.storeIds.map((id) =>
          id === D.id ? O.id : id,
        );
        const uniqueStoreIds = Array.from(new Set(updatedStoreIds));

        await prisma.visitPlan.update({
          where: { id: plan.id },
          data: {
            storeIds: uniqueStoreIds,
          },
        });
      }
      if (plansD.length > 0) {
        console.log(
          `   ✅ Updated ${plansD.length} visit plans containing duplicate store.`,
        );
      }

      // StoreChainConfig (excludedStoreIds String[])
      const chainConfigs = await prisma.storeChainConfig.findMany({
        where: {
          excludedStoreIds: {
            has: D.id,
          },
        },
      });
      for (const config of chainConfigs) {
        const updatedExcludes = config.excludedStoreIds.map((id) =>
          id === D.id ? O.id : id,
        );
        const uniqueExcludes = Array.from(new Set(updatedExcludes));

        await prisma.storeChainConfig.update({
          where: { id: config.id },
          data: {
            excludedStoreIds: uniqueExcludes,
          },
        });
      }
      if (chainConfigs.length > 0) {
        console.log(
          `   ✅ Updated ${chainConfigs.length} store chain configs.`,
        );
      }

      // 4. Finally, delete the duplicate Store record
      await prisma.store.delete({
        where: { id: D.id },
      });
      console.log(
        `   🗑️  Deleted duplicate store [${D.storeName} (ID: ${D.id})] from Store collection.`,
      );

      mergedCount++;
    }

    console.log(
      `\n🎉 Successfully merged all ${mergedCount} selected duplicate stores!`,
    );

    // 5. Export final list of stores to Excel
    console.log("\n📡 Querying final stores in database for export...");
    const finalStores = await prisma.store.findMany();
    console.log(`✅ Database currently has ${finalStores.length} stores.`);

    const excelData = finalStores.map((store) => ({
      "Store ID": store.id,
      "Store Name": store.storeName,
      City: store.city,
      "Full Address": store.fullAddress || "",
      Latitude: store.latitude || "",
      Longitude: store.longitude || "",
      "Partner Brand IDs": store.partnerBrandIds?.join(", ") || "",
      "Partner Brand Types": store.partnerBrandTypes?.join(", ") || "",
      "Store Type": store.storeType || "",
      "Store Channel": store.storeChannel || "",
      "City Tier": store.cityTier || "",
      State: store.state || "",
      Priority: store.priority || "",
    }));

    const filename = "final_stores_export.xlsx";
    const filepath = path.join(process.cwd(), filename);
    console.log(`📁 Saving final stores list to ${filename}...`);

    const workbookOutput = XLSX.utils.book_new();
    const worksheetOutput = XLSX.utils.json_to_sheet(excelData);

    // Auto-fit column widths
    if (excelData.length > 0) {
      const maxWidth = 55;
      const colWidths = Object.keys(excelData[0]).map((key) => ({
        wch: Math.min(
          Math.max(
            key.length,
            ...excelData.map((row) => String(row[key] || "").length),
          ),
          maxWidth,
        ),
      }));
      worksheetOutput["!cols"] = colWidths;
    }

    XLSX.utils.book_append_sheet(workbookOutput, worksheetOutput, "Stores");
    XLSX.writeFile(workbookOutput, filepath);

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
