import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  currentRow?: number;
  totalRows?: number;
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
  };
}

async function postSales(rowObj: Record<string, any>, storeCount: number): Promise<string> {
  try {
    const { Store_ID, Brand, Category, ...monthMetrics } = rowObj;
    const context = `Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
    
    if (!Store_ID || !Brand || !Category) {
      return `❌ Missing Store_ID, Brand, or Category. ${context}`;
    }

    const store = await prisma.store.findUnique({ where: { id: Store_ID } });
    if (!store) return `❌ Store not found. ${context}`;
    
    const brand = await prisma.brand.findUnique({ where: { brandName: Brand } });
    if (!brand) return `❌ Brand not found. ${context}`;
    
    const category = await prisma.category.findUnique({ where: { categoryName: Category } });
    if (!category) return `❌ Category not found. ${context}`;
    
    if (!store.partnerBrandIds.includes(brand.id)) {
      return `❌ Brand is not mapped to this store. ${context}`;
    }
    
    const catBrand = await prisma.categoryBrand.findUnique({
      where: { brandId_categoryId: { brandId: brand.id, categoryId: category.id } }
    });
    if (!catBrand) {
      return `❌ Category is not mapped to this brand. ${context}`;
    }

    const salesByYear: Record<number, any[]> = {};
    for (const key in monthMetrics) {
      const match = key.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4}) (.+)$/);
      if (!match) continue;
      const [_, dd, mm, yyyy, metric] = match;
      const year = parseInt(yyyy, 10);
      const month = parseInt(mm, 10);
      if (!salesByYear[year]) salesByYear[year] = [];
      let entry = salesByYear[year].find(e => e.month === month);
      if (!entry) {
        entry = { month };
        salesByYear[year].push(entry);
      }
      if (/device sales/i.test(metric)) entry.deviceSales = monthMetrics[key] || 0;
      if (/plan sales/i.test(metric)) entry.planSales = monthMetrics[key] || 0;
      if (/attach ?%/i.test(metric)) entry.attachPct = monthMetrics[key] || 0;
      if (/revenue/i.test(metric)) entry.revenue = monthMetrics[key] || 0;
    }

    for (const yearStr in salesByYear) {
      const year = parseInt(yearStr, 10);
      const monthlySales = salesByYear[year];
      await prisma.salesRecord.upsert({
        where: {
          storeId_brandId_categoryId_year: {
            storeId: Store_ID,
            brandId: brand.id,
            categoryId: category.id,
            year,
          },
        },
        update: { monthlySales },
        create: {
          storeId: Store_ID,
          brandId: brand.id,
          categoryId: category.id,
          year,
          monthlySales,
          dailySales: [],
        },
      });
    }
    return `✅ Sales data stored successfully for ${context}. Total stores pushed: ${storeCount}`;
  } catch (err) {
    console.error(err);
    const { Store_ID, Brand, Category } = rowObj;
    return `❌ Internal server error for Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
  }
}

async function postDailySales(rowObj: Record<string, any>, successCount: number): Promise<string> {
  try {
    const { Store_ID, Brand, Category, ...dateMetrics } = rowObj;
    const context = `Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
    
    if (!Store_ID || !Brand || !Category) {
      return `❌ Missing Store_ID, Brand, or Category. ${context}`;
    }
    
    const store = await prisma.store.findUnique({ where: { id: Store_ID } });
    if (!store) return `❌ Store not found. ${context}`;
    
    const brand = await prisma.brand.findUnique({ where: { brandName: Brand } });
    if (!brand) return `❌ Brand not found. ${context}`;
    
    const category = await prisma.category.findUnique({ where: { categoryName: Category } });
    if (!category) return `❌ Category not found. ${context}`;
    
    if (!store.partnerBrandIds.includes(brand.id)) {
      return `❌ Brand is not mapped to this store. ${context}`;
    }
    
    const catBrand = await prisma.categoryBrand.findUnique({
      where: { brandId_categoryId: { brandId: brand.id, categoryId: category.id } }
    });
    if (!catBrand) {
      return `❌ Category is not mapped to this brand. ${context}`;
    }

    // Build dailySales array
    const dailySales: any[] = [];
    for (const key in dateMetrics) {
      const match = key.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4}) (Count of Sales|Revenue)$/);
      if (!match) continue;
      const [_, dd, mm, yyyy, metric] = match;
      const date = `${yyyy}-${mm}-${dd}`; // ISO format
      let entry = dailySales.find(e => e.date === date);
      if (!entry) {
        entry = { date };
        dailySales.push(entry);
      }
      if (/count of sales/i.test(metric)) entry.countOfSales = dateMetrics[key] || 0;
      if (/revenue/i.test(metric)) entry.revenue = dateMetrics[key] || 0;
    }

    // Upsert SalesRecord for the year
    const year = dailySales.length > 0 ? parseInt(dailySales[0].date.slice(0, 4)) : new Date().getFullYear();
    await prisma.salesRecord.upsert({
      where: {
        storeId_brandId_categoryId_year: {
          storeId: Store_ID,
          brandId: brand.id,
          categoryId: category.id,
          year,
        },
      },
      update: { dailySales },
      create: {
        storeId: Store_ID,
        brandId: brand.id,
        categoryId: category.id,
        year,
        monthlySales: [],
        dailySales,
      },
    });
    return `✅ Daily sales stored for ${context}. Total successful: ${successCount}`;
  } catch (err) {
    console.error(err);
    const { Store_ID, Brand, Category } = rowObj;
    return `❌ Internal server error for Store: ${Store_ID || 'N/A'}, Brand: ${Brand || 'N/A'}, Category: ${Category || 'N/A'}`;
  }
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
  
  // Create readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const importType = formData.get('type') as 'monthly' | 'daily';

        if (!file) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: 'No file uploaded'
          })}\n\n`));
          controller.close();
          return;
        }

        // Validate file type
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

        // Process Excel file
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
        const totalRows = range.e.r - range.s.r - 1; // Subtract header rows
        let successful = 0;
        let failed = 0;
        const errorLogs: string[] = [];

        // Send initial progress
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          currentRow: 0,
          totalRows,
          message: `📊 Starting to process ${totalRows} rows...`
        })}\n\n`));

        // Process each row
        for (let r = range.s.r + 2; r <= range.e.r; ++r) {
          const currentRow = r - range.s.r - 1;
          
          try {
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
            
            const message = importType === 'monthly' 
              ? await postSales(rowObj, successful + 1)
              : await postDailySales(rowObj, successful + 1);
              
            const isSuccess = message.startsWith('✅');
            if (isSuccess) {
              successful++;
            } else {
              failed++;
              errorLogs.push(message);
            }

            // Send row progress update
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              currentRow,
              totalRows,
              rowData: {
                Store_ID: rowObj.Store_ID,
                Brand: rowObj.Brand,
                Category: rowObj.Category,
                status: isSuccess ? 'success' : 'error',
                message: message.replace(/Store:.*?(?=Total|$)/, '').trim() // Clean up message
              }
            })}\n\n`));

            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 50));
            
          } catch (err) {
            failed++;
            const msg = `❌ Error parsing row ${currentRow}: ${err}`;
            errorLogs.push(msg);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              currentRow,
              totalRows,
              rowData: {
                Store_ID: 'N/A',
                Brand: 'N/A',
                Category: 'N/A',
                status: 'error',
                message: msg
              }
            })}\n\n`));
          }
        }

        // Send completion summary
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          summary: {
            totalRows,
            successful,
            failed,
            errors: errorLogs
          }
        })}\n\n`));

        controller.close();
        
      } catch (error) {
        console.error('Streaming import error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to process Excel file'
        })}\n\n`));
        controller.close();
      } finally {
        await prisma.$disconnect();
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