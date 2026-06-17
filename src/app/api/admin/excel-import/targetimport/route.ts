import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import type { TargetCacheData } from "@/lib/optimized-target-import";
import {
  batchProcessTargetRecords,
  closePrismaConnection,
  getPrismaInstance,
  initializeTargetCache,
  optimizedPostTarget,
} from "@/lib/optimized-target-import";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let cache: TargetCacheData | null = null;

      try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: "No file uploaded",
              })}\n\n`,
            ),
          );
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
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message:
                  "Invalid file type. Please upload an Excel file (.xlsx or .xls)",
              })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        const prisma = getPrismaInstance();

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              phase: "cache_init",
              message: "🔄 Initializing target reference cache...",
            })}\n\n`,
          ),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));
        cache = await initializeTargetCache(prisma);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              phase: "cache_complete",
              message: "✅ Target cache successfully loaded!",
            })}\n\n`,
          ),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              phase: "file_parse",
              message: "📊 Parsing Excel file...",
            })}\n\n`,
          ),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const workbook = XLSX.read(buffer);
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");

        // Parse headers (row 1 is at index range.s.r)
        const headerRow: string[] = [];
        for (let c = range.s.c; c <= range.e.c; ++c) {
          const val = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v;
          headerRow.push(val ? String(val).trim() : "");
        }

        const totalRows = range.e.r - range.s.r;
        let successful = 0;
        let failed = 0;
        const errorLogs: string[] = [];
        const batchData: Array<{
          storeId: string;
          brandId: string;
          categoryId: string;
          month: number;
          year: number;
          targetRevenue: number | null;
          targetUnits: number | null;
          context: string;
        }> = [];

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              phase: "debug",
              message: `📋 Structure check: Found ${totalRows} data rows under header row.`,
            })}\n\n`,
          ),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (totalRows <= 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "progress",
                message: "⚠️ No data rows found in the uploaded file.",
              })}\n\n`,
            ),
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                summary: {
                  totalRows: 0,
                  successful: 0,
                  failed: 0,
                  errors: ["No data rows found in the Excel file"],
                  processingTime: "0.00s",
                },
              })}\n\n`,
            ),
          );

          controller.close();
          return;
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              currentRow: 0,
              totalRows,
              phase: "processing",
              message: `🚀 Initiating row validations...`,
            })}\n\n`,
          ),
        );

        if (!cache) {
          throw new Error("Reference data cache failed to initialize");
        }

        // Loop from row index range.s.r + 1 to range.e.r
        for (let r = range.s.r + 1; r <= range.e.r; ++r) {
          const currentRow = r - range.s.r;

          try {
            if (currentRow % 5 === 1) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    message: `🔍 Validating rows ${currentRow}-${Math.min(currentRow + 4, totalRows)}/${totalRows}...`,
                  })}\n\n`,
                ),
              );
            }

            const rowObj: Record<string, unknown> = {};
            for (let c = range.s.c; c <= range.e.c; ++c) {
              const cell = ws[XLSX.utils.encode_cell({ r, c })];
              const header = headerRow[c - range.s.c];
              if (header) {
                rowObj[header] = cell ? cell.v : null;
              }
            }

            const message = await optimizedPostTarget(
              rowObj,
              successful + 1,
              cache,
            );

            try {
              const parsedMessage = JSON.parse(message);
              if (parsedMessage.success) {
                successful++;
                batchData.push(parsedMessage.data);

                if (currentRow % 3 === 0) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "progress",
                        currentRow,
                        totalRows,
                        phase: "validating",
                        rowData: {
                          StoreBrand_ID: String(
                            rowObj.StoreBrand_ID || rowObj.StoreBrand || "",
                          ),
                          Category: String(rowObj.Category || ""),
                          status: "success",
                          message: `✅ Row is valid and queued`,
                        },
                      })}\n\n`,
                    ),
                  );
                }
              } else {
                throw new Error(message);
              }
            } catch (parseError) {
              failed++;
              errorLogs.push(message);

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    currentRow,
                    totalRows,
                    phase: "validating",
                    message: `❌ Row ${currentRow} validation failed: ${parseError}`,
                    rowData: {
                      StoreBrand_ID: String(
                        rowObj.StoreBrand_ID || rowObj.StoreBrand || "N/A",
                      ),
                      Category: String(rowObj.Category || "N/A"),
                      status: "error",
                      message: message.replace(/❌ /, ""),
                    },
                  })}\n\n`,
                ),
              );
            }

            if (currentRow % 5 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } catch (err) {
            failed++;
            const msg = `❌ Error parsing row ${currentRow}: ${err}`;
            errorLogs.push(msg);

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  currentRow,
                  totalRows,
                  phase: "error",
                  rowData: {
                    StoreBrand_ID: "N/A",
                    Category: "N/A",
                    status: "error",
                    message: msg,
                  },
                })}\n\n`,
              ),
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              message: `📊 Finished validations. Ready to commit: ${successful} rows valid, ${failed} failed.`,
            })}\n\n`,
          ),
        );

        // Commit to database
        if (batchData.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "progress",
                phase: "batch_processing",
                message: `💾 Writing ${batchData.length} records to the database in batch...`,
              })}\n\n`,
            ),
          );

          try {
            const batchResult = await batchProcessTargetRecords(batchData, 50);

            if (batchResult.failed > 0) {
              failed += batchResult.failed;
              successful -= batchResult.failed;
              errorLogs.push(...batchResult.errors);
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  phase: "batch_complete",
                  message: `✅ Batch write completed successfully: ${batchResult.successful} targets imported/updated.`,
                })}\n\n`,
              ),
            );
          } catch (batchError) {
            console.error("Batch processing exception:", batchError);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  phase: "batch_error",
                  message: `❌ Exception during database batch writing: ${batchError}`,
                })}\n\n`,
              ),
            );
            errorLogs.push(`Batch writing error: ${batchError}`);
          }
        }

        const endTime = Date.now();
        const processingTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "complete",
              summary: {
                totalRows,
                successful,
                failed,
                errors: errorLogs,
                processingTime,
              },
            })}\n\n`,
          ),
        );

        controller.close();
      } catch (error) {
        console.error("Target import route error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              message:
                error instanceof Error ? error.message : "Processing failed",
            })}\n\n`,
          ),
        );
        controller.close();
      } finally {
        await closePrismaConnection();
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
