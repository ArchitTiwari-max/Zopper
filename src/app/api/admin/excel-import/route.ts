import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ImportResult {
  totalRows: number;
  successful: number;
  failed: number;
  errors: string[];
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

async function processExcelFile(buffer: Buffer, importType: 'monthly' | 'daily'): Promise<ImportResult> {
  try {
    const workbook = XLSX.read(buffer);
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref']!);

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
    let totalRows = 0;
    let successful = 0;
    let failed = 0;
    const errorLogs: string[] = [];

    for (let r = range.s.r + 2; r <= range.e.r; ++r) {
      totalRows++;
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
          
        if (message.startsWith('✅')) {
          successful++;
        } else {
          failed++;
          errorLogs.push(message);
        }
      } catch (err) {
        failed++;
        const msg = `❌ Error parsing row ${r - range.s.r - 1}: ${err}`;
        errorLogs.push(msg);
      }
    }

    return {
      totalRows,
      successful,
      failed,
      errors: errorLogs
    };
  } catch (error) {
    throw new Error(`Failed to process Excel file: ${error}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importType = formData.get('type') as 'monthly' | 'daily';

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!importType || !['monthly', 'daily'].includes(importType)) {
      return NextResponse.json(
        { error: 'Invalid import type. Must be "monthly" or "daily"' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process the Excel file
    const result = await processExcelFile(buffer, importType);

    return NextResponse.json({
      success: true,
      message: 'Excel file processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Excel import error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process Excel file',
        success: false 
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}