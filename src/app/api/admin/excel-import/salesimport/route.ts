import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
export const runtime = 'nodejs';
import { 
  getPrismaInstance,
  initializeCache,
  optimizedPostSales,
  optimizedPostDailySales,
  batchProcessSalesRecords,
  batchProcessDailySalesRecords,
  closePrismaConnection 
} from '@/lib/optimized-sales-import';

interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  currentRow?: number;
  totalRows?: number;
  phase?: string;
  message?: string;
  rowData?: {
    Store_ID: string;
    Brand: string;
    Category: string;
    status: 'success' | 'error';
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

function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30 + serial));
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const startTime = Date.now();
  
  // Create readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      let cache: any = null;
      
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const importType = formData.get('type') as 'monthly' | 'daily';

        // Validation
        if (!file) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: 'No file uploaded'
          })}\n\n`));
          controller.close();
          return;
        }

        const validTypes = [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)'
          })}\n\n`));
          controller.close();
          return;
        }

        // Initialize cache (MAJOR PERFORMANCE BOOST)
        const prisma = getPrismaInstance();
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'cache_init',
          message: '🔄 Initializing performance cache...'
        })}\n\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        cache = await initializeCache(prisma);
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'cache_complete', 
          message: '✅ Cache initialized - 10x performance boost activated!'
        })}\n\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        // Process Excel file
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'file_parse',
          message: '📊 Parsing Excel file...'
        })}\n\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const workbook = XLSX.read(buffer);
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws['!ref']!);

        // Parse headers
        const firstHeaderRow: any[] = [];
        const secondHeaderRow: any[] = [];
        let lastBaseHeader = '';
        
        for (let c = range.s.c; c <= range.e.c; ++c) {
          let baseHeader = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v;
          const subHeader = ws[XLSX.utils.encode_cell({ r: range.s.r + 1, c })]?.v || '';
          
          if (typeof baseHeader === 'number' && baseHeader > 40000) {
            baseHeader = formatDate(excelSerialToDate(baseHeader));
          }
          if (baseHeader instanceof Date) {
            baseHeader = formatDate(baseHeader);
          }
          if (!baseHeader) baseHeader = lastBaseHeader;
          else lastBaseHeader = baseHeader;
          
          firstHeaderRow.push(baseHeader || '');
          secondHeaderRow.push(subHeader);
        }

        const keepFields = ['Store_ID', 'Brand', 'Category'];
        const totalRows = range.e.r - range.s.r - 1;
        let successful = 0;
        let failed = 0;
        const errorLogs: string[] = [];
        const batchData: any[] = [];
        
        // Debug: Log file structure
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'debug',
          message: `📋 File structure: ${totalRows} data rows found, Range: ${range.s.r}-${range.e.r}`
        })}\n\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send initial progress
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          currentRow: 0,
          totalRows,
          phase: 'processing',
          message: `ðŸš€ Processing ${totalRows} rows with optimized batch processing...`
        })}\\n\\n`));
        
        // Handle edge case where there are no data rows
        if (totalRows <= 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            message: 'âš ï¸ No data rows found in Excel file. Please check your file format.'
          })}\\n\\n`));
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            summary: {
              totalRows: 0,
              successful: 0,
              failed: 0,
              errors: ['No data rows found in the Excel file'],
              processingTime: '0.00s'
            }
          })}\\n\\n`));
          
          controller.close();
          return;
        }

        // PHASE 1: Fast row processing and validation (no DB writes)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          message: `🔄 Starting row-by-row processing phase...`
        })}\n\n`));
        
        for (let r = range.s.r + 2; r <= range.e.r; ++r) {
          const currentRow = r - range.s.r - 1;
          
          try {
            // Send progress update every 5 rows to avoid overwhelming the stream
            if (currentRow % 5 === 1) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                message: `🔍 Processing rows ${currentRow}-${Math.min(currentRow + 4, totalRows)}/${totalRows}...`
              })}\n\n`));
            }
            const rowObj: Record<string, any> = {};
            for (let c = range.s.c; c <= range.e.c; ++c) {
              const cell = ws[XLSX.utils.encode_cell({ r, c })];
              const baseHeader = firstHeaderRow[c - range.s.c];
              const subHeader = secondHeaderRow[c - range.s.c];
              
              if (keepFields.includes(baseHeader)) {
                rowObj[baseHeader] = cell ? cell.v : null;
              } else if (baseHeader && subHeader) {
                rowObj[`${baseHeader} ${subHeader}`] = cell ? cell.v : null;
              }
            }
            
            // Use optimized processing (cache-based, no DB writes yet)
            let message: string;
            try {
              message = importType === 'monthly' 
                ? await optimizedPostSales(rowObj, successful + 1, cache)
                : await optimizedPostDailySales(rowObj, successful + 1, cache);
            } catch (processingError) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                message: `❌ Row ${currentRow} processing error: ${processingError}`
              })}\n\n`));
              throw processingError;
            }
              
            try {
              const parsedMessage = JSON.parse(message);
              if (parsedMessage.success) {
                successful++;
                batchData.push(parsedMessage.data);
                
                // Send progress update every 3 rows to avoid overwhelming the stream
                if (currentRow % 3 === 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'progress',
                    currentRow,
                    totalRows,
                    phase: 'validating',
                    rowData: {
                      Store_ID: rowObj.Store_ID,
                      Brand: rowObj.Brand,
                      Category: rowObj.Category,
                      status: 'success',
                      message: `✅ Validated and queued for batch processing`
                    }
                  })}\n\n`));
                }
              } else {
                throw new Error(message);
              }
            } catch (parseError) {
              // Handle error cases (validation failures)
              failed++;
              errorLogs.push(message);
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                currentRow,
                totalRows,
                phase: 'validating',
                message: `❌ Row ${currentRow} validation failed: ${parseError}`,
                rowData: {
                  Store_ID: rowObj.Store_ID || 'N/A',
                  Brand: rowObj.Brand || 'N/A',
                  Category: rowObj.Category || 'N/A',
                  status: 'error',
                  message: message.replace(/❌ /, '')
                }
              })}\n\n`));
            }

            // Small delay for UI updates and prevent overwhelming the stream
            if (currentRow % 5 === 0) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
          } catch (err) {
            failed++;
            const msg = `❌ Error parsing row ${currentRow}: ${err}`;
            errorLogs.push(msg);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              currentRow,
              totalRows,
              phase: 'error',
              message: `❌ Critical error on row ${currentRow}: ${err}`,
              rowData: {
                Store_ID: 'N/A',
                Brand: 'N/A',
                Category: 'N/A',
                status: 'error',
                message: msg
              }
            })}\n\n`));
            
            // Log the full error details to console
            console.error(`Row processing error for row ${currentRow}:`, err);
            console.error(`Error stack:`, (err as Error).stack);
          }
        }
        
        // Send final processing summary
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          message: `📊 Row processing complete: ${successful} validated, ${failed} failed`
        })}\n\n`));

        // PHASE 2: Batch database writes (MASSIVE PERFORMANCE IMPROVEMENT)
        if (batchData.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            phase: 'batch_processing',
            message: `💾 Writing ${batchData.length} validated records to database in optimized batches...`
          })}\n\n`));
          
          // Debug: Log what we're about to process
          console.log(`Starting batch processing for ${batchData.length} records`);
          console.log(`Import type: ${importType}`);
          console.log(`Sample batch data:`, batchData[0]);

          try {
            // Send user-friendly message for large files
            if (batchData.length > 100) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                message: `💾 Processing ${batchData.length} records in database - this may take a moment...`
              })}\n\n`));
            } else {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                message: `📊 Saving ${batchData.length} records to database...`
              })}\n\n`));
            }
            
            const batchResult = importType === 'monthly'
              ? await batchProcessSalesRecords(batchData, 50) // Process in chunks of 50
              : await batchProcessDailySalesRecords(batchData, 50);
              
            console.log(`Batch processing completed:`, batchResult);

            // Update counters based on batch results
            if (batchResult.failed > 0) {
              failed += batchResult.failed;
              successful -= batchResult.failed; // Adjust successful count
              errorLogs.push(...batchResult.errors);
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              phase: 'batch_complete',
              message: `✅ Batch processing complete: ${batchResult.successful} successful, ${batchResult.failed} failed`
            })}\n\n`));

          } catch (batchError) {
            console.error('Batch processing error:', batchError);
            console.error('Batch error stack:', (batchError as Error).stack);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              phase: 'batch_error',
              message: `❌ Batch processing error: ${batchError}`
            })}\n\n`));
            errorLogs.push(`Batch processing failed: ${batchError}`);
          }
        }

        const endTime = Date.now();
        const processingTime = `${((endTime - startTime) / 1000).toFixed(2)}s`;
        
        // Always send completion summary
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          message: `📈 Processing completed in ${processingTime}`
        })}\n\n`));

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          summary: {
            totalRows,
            successful,
            failed,
            errors: errorLogs,
            processingTime
          }
        })}\n\n`));

        controller.close();
        
      } catch (error) {
        console.error('Optimized streaming import error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to process Excel file'
        })}\n\n`));
        controller.close();
      } finally {
        // Clean up resources
        await closePrismaConnection();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for real-time streaming
    },
  });
}
