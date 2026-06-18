import { PrismaClient } from "@prisma/client";
import path from "path";
import * as xlsx from "xlsx";

const prisma = new PrismaClient();

async function main() {
  const excelFilePath = path.join(
    process.cwd(),
    "testing/stores-export-2026-06-15 (1).xlsx",
  );
  console.log(`Loading Excel file from: ${excelFilePath}`);

  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[] = xlsx.utils.sheet_to_json(sheet);

  console.log(`Total rows in excel: ${data.length}`);

  const duplicatePairs = [];
  for (const row of data) {
    const storeId1 = row["Store_ID"];
    const storeId2 = row["Duplicate Store ID (Lower Visits)"];
    if (
      storeId1 &&
      storeId2 &&
      typeof storeId2 === "string" &&
      storeId2.trim() !== ""
    ) {
      duplicatePairs.push({ storeId1, storeId2 });
    }
  }

  console.log(`Found ${duplicatePairs.length} duplicate pairs to process.`);

  for (const pair of duplicatePairs) {
    const { storeId1, storeId2 } = pair;

    // Validate both stores exist
    const [store1, store2] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId1 } }),
      prisma.store.findUnique({ where: { id: storeId2 } }),
    ]);

    if (!store1 || !store2) {
      console.log(
        `Skipping ${storeId1} and ${storeId2} as one or both do not exist in DB.`,
      );
      continue;
    }

    // Count visits for store1
    const [s1Visits, s1DigVisits, s1AdminVisits] = await Promise.all([
      prisma.visit.count({ where: { storeId: storeId1 } }),
      prisma.digitalVisit.count({ where: { storeId: storeId1 } }),
      prisma.adminVisit.count({ where: { storeId: storeId1 } }),
    ]);
    const s1Total = s1Visits + s1DigVisits + s1AdminVisits;

    // Count visits for store2
    const [s2Visits, s2DigVisits, s2AdminVisits] = await Promise.all([
      prisma.visit.count({ where: { storeId: storeId2 } }),
      prisma.digitalVisit.count({ where: { storeId: storeId2 } }),
      prisma.adminVisit.count({ where: { storeId: storeId2 } }),
    ]);
    const s2Total = s2Visits + s2DigVisits + s2AdminVisits;

    let winnerId = storeId1;
    let loserId = storeId2;

    if (s2Total > s1Total) {
      winnerId = storeId2;
      loserId = storeId1;
    }

    console.log(`\nProcessing Pair: ${storeId1} vs ${storeId2}`);
    console.log(`Winner: ${winnerId} (${Math.max(s1Total, s2Total)} visits)`);
    console.log(`Loser: ${loserId} (${Math.min(s1Total, s2Total)} visits)`);

    try {
      await prisma.$transaction(
        async (tx) => {
          // 1. Visits, DigitalVisits, AdminVisits
          await tx.visit.updateMany({
            where: { storeId: loserId },
            data: { storeId: winnerId },
          });
          await tx.digitalVisit.updateMany({
            where: { storeId: loserId },
            data: { storeId: winnerId },
          });
          await tx.adminVisit.updateMany({
            where: { storeId: loserId },
            data: { storeId: winnerId },
          });

          // 2. HolidayRequest
          await tx.holidayRequest.updateMany({
            where: { storeId: loserId },
            data: { storeId: winnerId },
          });

          // 3. VisitPlan (PJP arrays)
          const visitPlans = await tx.visitPlan.findMany({
            where: { storeIds: { has: loserId } },
          });
          for (const plan of visitPlans) {
            const updatedStoreIds = plan.storeIds.map((id) =>
              id === loserId ? winnerId : id,
            );
            const uniqueStoreIds = Array.from(new Set(updatedStoreIds));
            await tx.visitPlan.update({
              where: { id: plan.id },
              data: { storeIds: uniqueStoreIds },
            });
          }

          // 4. ExecutiveStoreAssignment
          const loserAssignments = await tx.executiveStoreAssignment.findMany({
            where: { storeId: loserId },
          });
          for (const assign of loserAssignments) {
            const existingWinnerAssign =
              await tx.executiveStoreAssignment.findUnique({
                where: {
                  executiveId_storeId: {
                    executiveId: assign.executiveId,
                    storeId: winnerId,
                  },
                },
              });
            if (existingWinnerAssign) {
              await tx.executiveStoreAssignment.delete({
                where: { id: assign.id },
              });
            } else {
              await tx.executiveStoreAssignment.update({
                where: { id: assign.id },
                data: { storeId: winnerId },
              });
            }
          }

          // 5. StoreBrand
          const loserBrands = await tx.storeBrand.findMany({
            where: { storeId: loserId },
          });
          for (const sb of loserBrands) {
            const existingWinnerBrand = await tx.storeBrand.findUnique({
              where: {
                storeId_brandId: { storeId: winnerId, brandId: sb.brandId },
              },
            });
            if (existingWinnerBrand) {
              await tx.storeBrand.delete({ where: { id: sb.id } });
            } else {
              await tx.storeBrand.update({
                where: { id: sb.id },
                data: { storeId: winnerId },
              });
            }
          }

          // 6. SalesRecord
          const loserSales = await tx.salesRecord.findMany({
            where: { storeId: loserId },
          });
          for (const sale of loserSales) {
            const existingWinnerSale = await tx.salesRecord.findUnique({
              where: {
                storeId_brandId_productCategoryId_year: {
                  storeId: winnerId,
                  brandId: sale.brandId,
                  productCategoryId: sale.productCategoryId,
                  year: sale.year,
                },
              },
            });
            if (existingWinnerSale) {
              await tx.salesRecord.delete({ where: { id: sale.id } });
            } else {
              await tx.salesRecord.update({
                where: { id: sale.id },
                data: { storeId: winnerId },
              });
            }
          }

          // 7. StoreTarget
          const loserTargets = await tx.storeTarget.findMany({
            where: { storeId: loserId },
          });
          for (const target of loserTargets) {
            const existingWinnerTarget = await tx.storeTarget.findUnique({
              where: {
                storeId_brandId_productCategoryId_month_year: {
                  storeId: winnerId,
                  brandId: target.brandId,
                  productCategoryId: target.productCategoryId,
                  month: target.month,
                  year: target.year,
                },
              },
            });
            if (existingWinnerTarget) {
              await tx.storeTarget.delete({ where: { id: target.id } });
            } else {
              await tx.storeTarget.update({
                where: { id: target.id },
                data: { storeId: winnerId },
              });
            }
          }

          // 8. StoreAlignment
          const loserAlignment = await tx.storeAlignment.findUnique({
            where: { storeId: loserId },
          });
          if (loserAlignment) {
            const existingWinnerAlignment = await tx.storeAlignment.findUnique({
              where: { storeId: winnerId },
            });
            if (existingWinnerAlignment) {
              await tx.storeAlignment.delete({
                where: { id: loserAlignment.id },
              });
            } else {
              await tx.storeAlignment.update({
                where: { id: loserAlignment.id },
                data: { storeId: winnerId },
              });
            }
          }

          // Finally, delete the Loser store
          await tx.store.delete({ where: { id: loserId } });
          console.log(`Successfully merged ${loserId} into ${winnerId}`);
        },
        {
          timeout: 20000, // Increase transaction timeout for safe execution
        },
      );
    } catch (error) {
      console.error(`Failed to process pair ${storeId1} - ${storeId2}`, error);
    }
  }

  console.log("\nDone processing all duplicate pairs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
