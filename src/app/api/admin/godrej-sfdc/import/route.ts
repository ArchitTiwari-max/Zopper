import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

interface ProgressUpdate {
  type: "progress" | "complete" | "error";
  currentRow?: number;
  totalRows?: number;
  phase?: string;
  message?: string;
  rowData?: {
    planId: string;
    phone: string;
    contractBookingId: string;
    customerName?: string | null;
    status: "success" | "error";
    message: string;
  };
  summary?: {
    totalRows: number;
    successful: number;
    failed: number;
    errors: string[];
    processingTime?: string;
  };
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const startTime = Date.now();

  // Create readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const importType = formData.get("type") as string; // Not used but kept for consistency

        // Validation
        if (!file) {
          controller.enqueue(
            encoder.encode(
              "data: " +
                JSON.stringify({
                  type: "error",
                  message: "No file uploaded",
                }) +
                "\n\n",
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
              "data: " +
                JSON.stringify({
                  type: "error",
                  message:
                    "Invalid file type. Please upload an Excel file (.xlsx or .xls)",
                }) +
                "\n\n",
            ),
          );
          controller.close();
          return;
        }

        // Process Excel file
        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "progress",
                phase: "file_parse",
                message: "Parsing Excel file...",
              }) +
              "\n\n",
          ),
        );

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const workbook = XLSX.read(buffer);
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws["!ref"]!);

        // Parse headers
        const firstHeaderRow: any[] = [];
        const secondHeaderRow: any[] = [];
        let lastBaseHeader = "";

        for (let c = range.s.c; c <= range.e.c; ++c) {
          let baseHeader = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v;
          const subHeader =
            ws[XLSX.utils.encode_cell({ r: range.s.r + 1, c })]?.v || "";

          if (typeof baseHeader === "number" && baseHeader > 40000) {
            baseHeader = "Date-" + baseHeader; // Simple conversion for dates
          }
          if (baseHeader instanceof Date) {
            baseHeader = baseHeader.toISOString().split("T")[0];
          }
          if (!baseHeader) baseHeader = lastBaseHeader;
          else lastBaseHeader = baseHeader;

          firstHeaderRow.push(baseHeader || "");
          secondHeaderRow.push(subHeader);
        }

        const keepFields = [
          "Plan Id",
          "Phone",
          "ContractBookingID",
          "Customer Name",
        ];
        const totalRows = range.e.r - range.s.r - 1;
        let successful = 0;
        let failed = 0;
        const errorLogs: string[] = [];
        const batchData: any[] = [];

        // Debug: Log file structure
        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "progress",
                phase: "debug",
                message:
                  "File structure: " +
                  totalRows +
                  " data rows found, Range: " +
                  range.s.r +
                  "-" +
                  range.e.r,
              }) +
              "\n\n",
          ),
        );

        // Send initial progress
        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "progress",
                currentRow: 0,
                totalRows,
                phase: "processing",
                message:
                  "Processing " +
                  totalRows +
                  " rows with optimized batch processing...",
              }) +
              "\n\n",
          ),
        );

        // Handle edge case where there are no data rows
        if (totalRows <= 0) {
          controller.enqueue(
            encoder.encode(
              "data: " +
                JSON.stringify({
                  type: "progress",
                  message:
                    "No data rows found in Excel file. Please check your file format.",
                }) +
                "\n\n",
            ),
          );

          controller.enqueue(
            encoder.encode(
              "data: " +
                JSON.stringify({
                  type: "complete",
                  summary: {
                    totalRows: 0,
                    successful: 0,
                    failed: 0,
                    errors: ["No data rows found in the Excel file"],
                    processingTime: "0.00s",
                  },
                }) +
                "\n\n",
            ),
          );

          controller.close();
          return;
        }

        // PHASE 1: Fast row processing and validation (no DB writes)
        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "progress",
                message: "Starting row-by-row processing phase...",
              }) +
              "\n\n",
          ),
        );

        for (let r = range.s.r + 2; r <= range.e.r; ++r) {
          const currentRow = r - range.s.r - 1;

          try {
            // Send progress update every 5 rows to avoid overwhelming the stream
            if (currentRow % 5 === 1) {
              controller.enqueue(
                encoder.encode(
                  "data: " +
                    JSON.stringify({
                      type: "progress",
                      message:
                        "Processing rows " +
                        currentRow +
                        "-" +
                        Math.min(currentRow + 4, totalRows) +
                        "/" +
                        totalRows +
                        "...",
                    }) +
                    "\n\n",
                ),
              );
            }
            const rowObj: Record<string, any> = {};
            for (let c = range.s.c; c <= range.e.c; ++c) {
              const cell = ws[XLSX.utils.encode_cell({ r, c })];
              const baseHeader = firstHeaderRow[c - range.s.c];
              const subHeader = secondHeaderRow[c - range.s.c];

              if (keepFields.includes(baseHeader)) {
                rowObj[baseHeader] = cell ? cell.v : null;
              } else if (baseHeader && subHeader) {
                rowObj[baseHeader + " " + subHeader] = cell ? cell.v : null;
              }
            }

            // Validate required fields
            if (
              !rowObj["Plan Id"] ||
              !rowObj["Phone"] ||
              !rowObj["ContractBookingID"]
            ) {
              throw new Error(
                "Missing required fields: Plan Id, Phone, or ContractBookingID",
              );
            }

            // Add to batch data
            batchData.push({
              planId: String(rowObj["Plan Id"]).trim(),
              phone: String(rowObj["Phone"]).trim(),
              contractBookingId: String(rowObj["ContractBookingID"]).trim(),
              customerName: rowObj["Customer Name"]
                ? String(rowObj["Customer Name"]).trim()
                : null,
            });

            successful++;

            // Send progress update every 3 rows to avoid overwhelming the stream
            if (currentRow % 3 === 0) {
              controller.enqueue(
                encoder.encode(
                  "data: " +
                    JSON.stringify({
                      type: "progress",
                      currentRow: currentRow,
                      totalRows: totalRows,
                      phase: "validating",
                      rowData: {
                        planId: rowObj["Plan Id"],
                        phone: rowObj["Phone"],
                        contractBookingId: rowObj["ContractBookingID"],
                        customerName: rowObj["Customer Name"]
                          ? String(rowObj["Customer Name"]).trim()
                          : null,
                        status: "success",
                        message: "Validated and queued for batch processing",
                      },
                    }) +
                    "\n\n",
                ),
              );
            }

            // Small delay for UI updates and prevent overwhelming the stream
            if (currentRow % 5 === 0) {
              // Small delay to prevent SSE message concatenation
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } catch (err) {
            failed++;
            const msg =
              "Error processing row " +
              currentRow +
              ": " +
              (err instanceof Error ? err.message : String(err));
            errorLogs.push(msg);

            controller.enqueue(
              encoder.encode(
                "data: " +
                  JSON.stringify({
                    type: "progress",
                    currentRow: currentRow,
                    totalRows: totalRows,
                    phase: "error",
                    message: msg,
                    rowData: {
                      planId: "N/A",
                      phone: "N/A",
                      contractBookingId: "N/A",
                      customerName: null,
                      status: "error",
                      message: msg.replace(/❌ /g, ""),
                    },
                  }) +
                  "\n\n",
              ),
            );

            // Log the full error details to console
            console.error(
              "Row processing error for row " + currentRow + ":",
              err,
            );
          }
        }

        // Send final processing summary
        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "progress",
                message:
                  "Row processing complete: " +
                  successful +
                  " validated, " +
                  failed +
                  " failed",
              }) +
              "\n\n",
          ),
        );

        // PHASE 2: Batch database writes (PERFORMANCE IMPROVEMENT)
        if (batchData.length > 0) {
          controller.enqueue(
            encoder.encode(
              "data: " +
                JSON.stringify({
                  type: "progress",
                  phase: "batch_processing",
                  message:
                    "Writing " +
                    batchData.length +
                    " validated records to database in optimized batches...",
                }) +
                "\n\n",
            ),
          );

          // Debug: Log what we're about to process
          console.log(
            "Starting batch processing for " + batchData.length + " records",
          );
          console.log("Sample batch data:", batchData[0]);

          try {
            // Send user-friendly message for large files
            if (batchData.length > 100) {
              controller.enqueue(
                encoder.encode(
                  "data: " +
                    JSON.stringify({
                      type: "progress",
                      message:
                        "Processing " +
                        batchData.length +
                        " records in database - this may take a moment...",
                    }) +
                    "\n\n",
                ),
              );
            } else {
              controller.enqueue(
                encoder.encode(
                  "data: " +
                    JSON.stringify({
                      type: "progress",
                      message:
                        "Saving " +
                        batchData.length +
                        " records to database...",
                    }) +
                    "\n\n",
                ),
              );
            }

            // Insert records in batches
            const BATCH_SIZE = 50;
            let totalSuccessful = 0;
            let totalFailed = 0;
            const batchErrors: string[] = [];

            for (let i = 0; i < batchData.length; i += BATCH_SIZE) {
              const batch = batchData.slice(i, i + BATCH_SIZE);

              try {
                const result = await prisma.godrejSfdc.createMany({
                  data: batch,
                });

                totalSuccessful += result.count;

                // Log progress for large batches
                if (batchData.length > 100) {
                  controller.enqueue(
                    encoder.encode(
                      "data: " +
                        JSON.stringify({
                          type: "progress",
                          message:
                            "Processed " +
                            Math.min(i + BATCH_SIZE, batchData.length) +
                            "/" +
                            batchData.length +
                            " records...",
                        }) +
                        "\n\n",
                    ),
                  );
                }
              } catch (batchError) {
                console.error("Batch processing error:", batchError);
                totalFailed += batch.length;
                batchErrors.push(
                  "Batch failed: " +
                    (batchError instanceof Error
                      ? batchError.message
                      : String(batchError)),
                );

                // Add individual errors for each record in the failed batch
                for (const record of batch) {
                  errorLogs.push(
                    "Failed to insert record: planId=" +
                      record.planId +
                      ", phone=" +
                      record.phone +
                      ", contractBookingId=" +
                      record.contractBookingId,
                  );
                }
              }

              // Small delay between batches to prevent overwhelming
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Update counters based on batch results
            failed += totalFailed;

            controller.enqueue(
              encoder.encode(
                "data: " +
                  JSON.stringify({
                    type: "progress",
                    phase: "batch_complete",
                    message:
                      "Batch processing complete: " +
                      totalSuccessful +
                      " successful, " +
                      totalFailed +
                      " failed",
                  }) +
                  "\n\n",
              ),
            );
          } catch (batchError) {
            console.error("Batch processing error:", batchError);
            controller.enqueue(
              encoder.encode(
                "data: " +
                  JSON.stringify({
                    type: "progress",
                    phase: "batch_error",
                    message: "Batch processing error: " + batchError,
                  }) +
                  "\n\n",
              ),
            );
            errorLogs.push("Batch processing failed: " + batchError);
          }
        }

        const endTime = Date.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(2) + "s";

        // Always send completion summary
        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "progress",
                message: "Processing completed in " + processingTime,
              }) +
              "\n\n",
          ),
        );

        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "complete",
                summary: {
                  totalRows: totalRows,
                  successful: successful,
                  failed: failed,
                  errors: errorLogs,
                  processingTime: processingTime,
                },
              }) +
              "\n\n",
          ),
        );

        controller.close();
      } catch (error) {
        console.error("Godrej SFDC import error:", error);
        controller.enqueue(
          encoder.encode(
            "data: " +
              JSON.stringify({
                type: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to process Excel file",
              }) +
              "\n\n",
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering for real-time streaming
    },
  });
}
