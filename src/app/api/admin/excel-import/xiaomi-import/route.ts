import type { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const maxDuration = 300;

// Singleton Prisma for this route
let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

// ────────────────────────────────────────────────────────────────
// Helper: parse month/year from column headers like "Jul-26" / "July-2026"
// ────────────────────────────────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseMonthYear(header: string): { month: number; year: number } | null {
  // Match formats: "Jul-26", "Jul-2026", "July-26", "July-2026", "7-2026", "07-2026"
  const cleaned = header.trim();
  const match = cleaned.match(/^([a-zA-Z]+|[0-9]{1,2})[-/\s](\d{2,4})$/);
  if (!match) return null;

  const [, monthPart, yearPart] = match;
  let month: number;
  let year: number;

  // Parse month
  const monthNum = parseInt(monthPart, 10);
  if (!isNaN(monthNum)) {
    month = monthNum;
  } else {
    month = MONTH_MAP[monthPart.toLowerCase()] ?? 0;
  }
  if (!month || month < 1 || month > 12) return null;

  // Parse year
  const yearNum = parseInt(yearPart, 10);
  year = yearNum < 100 ? 2000 + yearNum : yearNum;
  if (year < 2020 || year > 2040) return null;

  return { month, year };
}

// ────────────────────────────────────────────────────────────────
// Helper: normalise store name for matching
// ────────────────────────────────────────────────────────────────
function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// ────────────────────────────────────────────────────────────────
// POST /api/admin/excel-import/xiaomi-import
// ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      const prisma = getPrisma();

      try {
        // ── 1. Parse multipart form ──────────────────────────
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
          send({ type: "error", message: "No file uploaded" });
          controller.close();
          return;
        }

        const validTypes = [
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];
        if (
          !validTypes.includes(file.type) &&
          !file.name.endsWith(".xlsx") &&
          !file.name.endsWith(".xls")
        ) {
          send({ type: "error", message: "Invalid file type. Please upload an Excel file (.xlsx or .xls)" });
          controller.close();
          return;
        }

        // ── 2. Pre-load Xiaomi brand + all Xiaomi stores ─────
        send({ type: "progress", phase: "cache_init", message: "🔄 Loading Xiaomi store cache..." });

        const xiaomiBrand = await prisma.brand.findFirst({
          where: { brandName: { equals: "Xiaomi", mode: "insensitive" } },
          select: { id: true, brandName: true },
        });

        if (!xiaomiBrand) {
          send({ type: "error", message: "Xiaomi brand not found in database. Please import Xiaomi stores first." });
          controller.close();
          return;
        }

        // Load all Xiaomi stores into a lookup map: normalisedName+state => store
        const xiaomiStores = await prisma.store.findMany({
          where: { storeCategory: "XIAOMI_TARGET" },
          select: { id: true, storeName: true, state: true },
        });

        // Build maps for fast lookup
        // Primary: name+state, Fallback: name only
        const storeByNameState = new Map<string, typeof xiaomiStores[0]>();
        const storeByName = new Map<string, typeof xiaomiStores[0]>();

        for (const s of xiaomiStores) {
          const normName = normalise(s.storeName);
          const normState = normalise(s.state ?? "");
          storeByNameState.set(`${normName}||${normState}`, s);
          // Only store first occurrence for name-only map
          if (!storeByName.has(normName)) {
            storeByName.set(normName, s);
          }
        }

        send({
          type: "progress",
          phase: "cache_complete",
          message: `✅ Loaded ${xiaomiStores.length} Xiaomi stores into cache`,
        });

        // ── 3. Parse Excel ───────────────────────────────────
        send({ type: "progress", phase: "file_parse", message: "📊 Parsing Excel file..." });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const workbook = XLSX.read(buffer);
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");

        // Parse header row
        const headerRow: string[] = [];
        for (let c = range.s.c; c <= range.e.c; ++c) {
          const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
          headerRow.push(cell ? String(cell.v).trim() : "");
        }

        // Detect column indices
        const colIndex = (names: string[]): number => {
          const lowerNames = names.map((n) => n.toLowerCase());
          return headerRow.findIndex((h) =>
            lowerNames.some((n) => h.toLowerCase().includes(n))
          );
        };

        const stateIdx = colIndex(["state"]);
        const retailerIdx = colIndex(["retailername", "retailer name", "retailer", "store name", "storename"]);

        // Find the target column: any header that matches month-year pattern
        let targetColIdx = -1;
        let targetMonthYear: { month: number; year: number } | null = null;
        for (let c = 0; c < headerRow.length; c++) {
          const parsed = parseMonthYear(headerRow[c]);
          if (parsed) {
            targetColIdx = c;
            targetMonthYear = parsed;
            break;
          }
        }

        // Achievement column: "Achievement", "Actual", "Achievement Revenue", etc.
        const achievementIdx = colIndex(["achievement", "actual", "achv", "ach"]);

        if (retailerIdx === -1) {
          send({ type: "error", message: `Could not find RetailerName column. Found headers: ${headerRow.join(", ")}` });
          controller.close();
          return;
        }

        if (targetColIdx === -1 || !targetMonthYear) {
          send({ type: "error", message: `Could not find a target month column (e.g. "Jul-26"). Found headers: ${headerRow.join(", ")}` });
          controller.close();
          return;
        }

        const { month, year } = targetMonthYear;
        const targetHeader = headerRow[targetColIdx];

        send({
          type: "progress",
          message: `📋 Columns detected — RetailerName: col ${retailerIdx + 1}, Month (${targetHeader}): col ${targetColIdx + 1}${achievementIdx >= 0 ? `, Achievement: col ${achievementIdx + 1}` : " — ⚠️ No Achievement column found (will skip achievement update)"}`,
        });
        send({
          type: "progress",
          message: `📅 Updating achievement data for period: ${month}/${year} (existing targets will NOT be changed)`,
        });

        const totalRows = range.e.r - range.s.r;
        if (totalRows <= 0) {
          send({ type: "error", message: "No data rows found in the Excel file" });
          controller.close();
          return;
        }

        send({ type: "progress", message: `📊 ${totalRows} data rows found. Starting processing...` });

        // ── 4. Process rows ──────────────────────────────────
        let successful = 0;
        let failed = 0;
        let notFound = 0;
        const errorLogs: string[] = [];

        // Batch upsert data — only achievementRevenue is updated, targets are untouched
        const upsertBatch: Array<{
          storeId: string;
          storeName: string;
          state: string;
          achievementRevenue: number | null;
        }> = [];

        for (let r = range.s.r + 1; r <= range.e.r; ++r) {
          const currentRow = r - range.s.r;

          const getCell = (colIdx: number) => {
            if (colIdx < 0) return null;
            const cell = ws[XLSX.utils.encode_cell({ r, c: colIdx })];
            return cell ? cell.v : null;
          };

          const retailerName = String(getCell(retailerIdx) ?? "").trim();
          if (!retailerName) continue; // skip empty rows

          const stateRaw = String(getCell(stateIdx) ?? "").trim();
          // Achievement: the only field admin fills in this import
          const achievementRaw = achievementIdx >= 0 ? getCell(achievementIdx) : null;
          const achievementRevenue = typeof achievementRaw === "number"
            ? achievementRaw
            : (achievementRaw !== null && achievementRaw !== "" && achievementRaw !== "—" && !isNaN(Number(achievementRaw))
              ? Number(achievementRaw)
              : null);

          // Find matching store
          const normName = normalise(retailerName);
          const normState = normalise(stateRaw);
          let matchedStore = storeByNameState.get(`${normName}||${normState}`) ?? storeByName.get(normName) ?? null;

          if (!matchedStore) {
            notFound++;
            const msg = `Row ${currentRow}: Store "${retailerName}" (State: ${stateRaw || "N/A"}) — not found in DB, skipped`;
            errorLogs.push(msg);
            send({
              type: "progress",
              currentRow,
              totalRows,
              rowData: {
                RetailerName: retailerName,
                State: stateRaw,
                status: "not_found",
                message: `Store not found — skipped`,
              },
            });
            continue;
          }

          upsertBatch.push({
            storeId: matchedStore.id,
            storeName: matchedStore.storeName,
            state: stateRaw,
            achievementRevenue,
          });

          if (currentRow % 10 === 0 || currentRow === totalRows) {
            send({
              type: "progress",
              currentRow,
              totalRows,
              message: `🔍 Validated ${currentRow}/${totalRows} rows...`,
            });
          }
        }

        send({
          type: "progress",
          message: `📊 Validation complete. ${upsertBatch.length} stores matched, ${notFound} not found.`,
        });

        // ── 5. Batch upsert to DB ─────────────────────────────
        if (upsertBatch.length > 0) {
          send({ type: "progress", phase: "batch_processing", message: `💾 Writing ${upsertBatch.length} records to database...` });

          const batchSize = 50;
          for (let i = 0; i < upsertBatch.length; i += batchSize) {
            const chunk = upsertBatch.slice(i, i + batchSize);

            await Promise.all(
              chunk.map(async (row) => {
                try {
                  // Only update achievementRevenue — do NOT overwrite existing targetRevenue
                  if (row.achievementRevenue === null) {
                    // No achievement value in this row — skip silently
                    successful++;
                    return;
                  }

                  await prisma.storeTarget.upsert({
                    where: {
                      storeId_brandId_month_year: {
                        storeId: row.storeId,
                        brandId: xiaomiBrand!.id,
                        month,
                        year,
                      },
                    },
                    update: {
                      achievementRevenue: row.achievementRevenue,
                    },
                    create: {
                      storeId: row.storeId,
                      brandId: xiaomiBrand!.id,
                      month,
                      year,
                      // target not set here — only achievement is being imported
                      achievementRevenue: row.achievementRevenue,
                    },
                  });
                  successful++;
                } catch (err) {
                  failed++;
                  errorLogs.push(`Store ${row.storeName}: ${err}`);
                }
              })
            );

            send({
              type: "progress",
              message: `💾 Saved ${Math.min(i + batchSize, upsertBatch.length)}/${upsertBatch.length} records...`,
            });
          }

          send({ type: "progress", phase: "batch_complete", message: `✅ Database write completed!` });
        }

        // ── 6. Done ───────────────────────────────────────────
        send({
          type: "complete",
          summary: {
            totalRows: upsertBatch.length + notFound,
            successful,
            failed,
            notFound,
            errors: errorLogs,
            month,
            year,
            targetHeader,
            hasAchievement: achievementIdx >= 0,
          },
        });

        controller.close();
      } catch (err) {
        console.error("Xiaomi import error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "Processing failed" })}\n\n`
          )
        );
        controller.close();
      } finally {
        await getPrisma().$disconnect().catch(() => {});
        _prisma = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
