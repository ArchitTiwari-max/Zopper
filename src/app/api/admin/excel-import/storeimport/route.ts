import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
export const runtime = 'nodejs';
import { 
  getPrismaInstance,
  initializeStoreCache,
  optimizedProcessStore,
  batchProcessStoreRecords,
  closePrismaConnection 
} from '@/lib/optimized-store-import';

interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  currentRow?: number;
  totalRows?: number;
  phase?: string;
  message?: string;
  rowData?: {
    Store_ID: string;
    Store_Name: string;
    City: string;
    status: 'success' | 'error';
    message: string;
    executivesAdded?: number;
    executivesRemoved?: number;
  };
  summary?: {
    totalRows: number;
    successful: number;
    failed: number;
    errors: string[];
    totalExecutivesAdded: number;
    totalExecutivesRemoved: number;
    processingTime?: string;
  };
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

        // Validation
        if (!file) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: 'No file uploaded'
          })}\\n\\n`));
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
          })}\\n\\n`));
          controller.close();
          return;
        }

        // Initialize cache (MAJOR PERFORMANCE BOOST)
        const prisma = getPrismaInstance();
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'cache_init',
          message: '🔄 Initializing store import cache...'
        })}\\n\\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        cache = await initializeStoreCache(prisma);
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'cache_complete', 
          message: '✅ Cache initialized - 10x performance boost activated!'
        })}\\n\\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        // Process Excel file
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'file_parse',
          message: '🏪 Parsing store Excel file...'
        })}\\n\\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const workbook = XLSX.read(buffer);
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws['!ref']!);

        let successful = 0;
        let failed = 0;
        const errorLogs: string[] = [];
        const batchData: any[] = [];
        
        // PHASE 1: Fast row processing and validation (no DB writes)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          message: `🔄 Starting row-by-row validation phase...`
        })}\\n\\n`));
        
        const storeData: any[] = XLSX.utils.sheet_to_json(ws); // Use first row as headers
        const totalRows = storeData.length; // Use actual data length
        
        // Debug: Log file structure
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'debug',
          message: `📋 Store file structure: ${totalRows} data rows found`
        })}\\n\\n`));
        
        // Small delay to prevent SSE message concatenation
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send initial progress
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          currentRow: 0,
          totalRows,
          phase: 'processing',
          message: `🚀 Processing ${totalRows} store rows with optimized batch processing...`
        })}\\n\\n`));
        
        // Handle edge case where there are no data rows
        if (totalRows <= 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            message: '⚠️ No data rows found in Excel file. Please check your file format.'
          })}\\n\\n`));
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            summary: {
              totalRows: 0,
              successful: 0,
              failed: 0,
              errors: ['No data rows found in the Excel file'],
              totalExecutivesAdded: 0,
              totalExecutivesRemoved: 0,
              processingTime: '0.00s'
            }
          })}\\n\\n`));
          
          controller.close();
          return;
        }
        
        // Debug: Log detected columns
        const detectedColumns = storeData.length > 0 ? Object.keys(storeData[0]) : [];
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          phase: 'debug',
          message: `🔍 Detected columns: ${detectedColumns.join(', ')}`
        })}\\n\\n`));
        
        // Debug: Show first row sample
        if (storeData.length > 0) {
          const firstRow = storeData[0];
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            phase: 'debug',
            message: `🔍 First row sample: Store_ID=${firstRow.Store_ID}, Store Name=${firstRow['Store Name']}, City=${firstRow.City}`
          })}\\n\\n`));
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        for (let i = 0; i < storeData.length; i++) {
          const rowObj = storeData[i];
          const currentRow = i + 1;
          
          try {
            // Process store row using optimized function
            const result = await optimizedProcessStore(rowObj, currentRow, cache);
            
            if (result.startsWith('{')) {
              // Success - parse the JSON result
              const parsedResult = JSON.parse(result);
              if (parsedResult.success) {
                successful++;
                batchData.push(parsedResult.data);
                
                // DON'T send progress update during validation - only during actual DB operations
                // This prevents showing "success" logs before data is actually written
              }
            } else {
              // Error message
              failed++;
              errorLogs.push(result);
              
              const progressData: ProgressUpdate = {
                type: 'progress',
                currentRow,
                totalRows,
                rowData: {
                  Store_ID: rowObj.Store_ID || 'N/A',
                  Store_Name: rowObj['Store Name'] || 'N/A',
                  City: rowObj.City || 'N/A',
                  status: 'error',
                  message: result
                }
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\\n\\n`));
            }
            
          } catch (err) {
            failed++;
            const msg = `❌ Error processing row ${currentRow}: ${err}`;
            errorLogs.push(msg);
            
            const progressData: ProgressUpdate = {
              type: 'progress',
              currentRow,
              totalRows,
              rowData: {
                Store_ID: rowObj.Store_ID || 'N/A',
                Store_Name: rowObj['Store Name'] || 'N/A',
                City: rowObj.City || 'N/A',
                status: 'error',
                message: msg
              }
            };
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\\n\\n`));
          }
        }

        // Debug: Log validation phase completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          message: `✅ Validation phase complete: ${successful} successful, ${failed} failed, ${batchData.length} ready for DB write`
        })}\\n\\n`));
        
        await new Promise(resolve => setTimeout(resolve, 100));

        // PHASE 2: Batch database operations
        if (batchData.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            message: `🔄 Writing ${batchData.length} validated stores to database...`
          })}\\n\\n`));
          
          await new Promise(resolve => setTimeout(resolve, 100));

          let batchResult = null;
          let processedCount = 0;
          try {
            batchResult = await batchProcessStoreRecords(batchData, prisma, (storeData, success, message) => {
              // Send real-time progress for actual database operations
              processedCount++;
              const progressData: ProgressUpdate = {
                type: 'progress',
                currentRow: processedCount,
                totalRows: batchData.length,
                rowData: {
                  Store_ID: storeData.storeId,
                  Store_Name: storeData.storeName,
                  City: storeData.city,
                  status: success ? 'success' : 'error',
                  message: success ? 'Database write successful' : message,
                  executivesAdded: success ? storeData.executivesToAdd.length : 0,
                  executivesRemoved: success ? storeData.executivesToRemove.length : 0
                }
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\\n\\n`));
            });
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              message: `✅ Batch processing completed: ${batchResult.successful} stores written, ${batchResult.failed} failed`
            })}\\n\\n`));
            
            await new Promise(resolve => setTimeout(resolve, 100));
          
            // Update final counts
            successful = batchResult.successful;
            failed += batchResult.failed;
            errorLogs.push(...batchResult.errors);
            
          } catch (batchError) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              message: `❌ Batch processing error: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`
            })}\\n\\n`));
            
            // Mark all as failed if batch processing fails
            failed = totalRows;
            successful = 0;
            errorLogs.push(`Batch processing failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
          }

          // Send completion message
          const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            summary: {
              totalRows,
              successful,
              failed,
              errors: errorLogs,
              totalExecutivesAdded: successful > 0 ? batchResult?.totalExecutivesAdded || 0 : 0,
              totalExecutivesRemoved: successful > 0 ? batchResult?.totalExecutivesRemoved || 0 : 0,
              processingTime: `${processingTime}s`
            }
          })}\\n\\n`));
        } else {
          // No valid data to process
          const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            summary: {
              totalRows,
              successful: 0,
              failed,
              errors: errorLogs,
              totalExecutivesAdded: 0,
              totalExecutivesRemoved: 0,
              processingTime: `${processingTime}s`
            }
          })}\\n\\n`));
        }

      } catch (error) {
        console.error('Store import error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to process store Excel file'
        })}\\n\\n`));
      } finally {
        // Clean up
        try {
          await closePrismaConnection();
        } catch (cleanup_error) {
          console.error('Cleanup error:', cleanup_error);
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}