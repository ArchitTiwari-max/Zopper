import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface MonthlySalesData {
  month: number;
  deviceSales: number;
  planSales: number;
  attachPct: number;
  revenue: number;
}

interface DailySalesData {
  date: string; // Format: "2024-01-15"
  deviceSales: number;
  planSales: number;
  attachPct: number;
  revenue: number;
}

interface CreateSalesRecordBody {
  storeId: string;
  brandId: string;
  categoryId: string;
  year: number;
  monthlySales: MonthlySalesData[]; // Required: Past 3 months data
  dailySales: DailySalesData[];     // Required: Current month daily data
}


export async function POST(request: NextRequest) {
  try {
    const body: CreateSalesRecordBody = await request.json();
    const { storeId, brandId, categoryId, year, monthlySales, dailySales } = body;

    // Validate required fields
    if (!storeId || !brandId || !categoryId || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: storeId, brandId, categoryId, year' },
        { status: 400 }
      );
    }

    if (!monthlySales || !Array.isArray(monthlySales)) {
      return NextResponse.json(
        { error: 'monthlySales is required and must be an array' },
        { status: 400 }
      );
    }

    if (!dailySales || !Array.isArray(dailySales)) {
      return NextResponse.json(
        { error: 'dailySales is required and must be an array' },
        { status: 400 }
      );
    }

    // Validate monthlySales structure
    for (const monthData of monthlySales) {
      if (!monthData.month || typeof monthData.deviceSales !== 'number' || 
          typeof monthData.planSales !== 'number' || typeof monthData.attachPct !== 'number' || 
          typeof monthData.revenue !== 'number') {
        return NextResponse.json(
          { error: 'Invalid monthlySales structure. Each item must have: month, deviceSales, planSales, attachPct, revenue' },
          { status: 400 }
        );
      }
    }

    // Validate dailySales structure
    for (const dayData of dailySales) {
      if (!dayData.date || typeof dayData.deviceSales !== 'number' || 
          typeof dayData.planSales !== 'number' || typeof dayData.attachPct !== 'number' || 
          typeof dayData.revenue !== 'number') {
        return NextResponse.json(
          { error: 'Invalid dailySales structure. Each item must have: date, deviceSales, planSales, attachPct, revenue' },
          { status: 400 }
        );
      }
    }

    // Check if store, brand, and category exist
    const [store, brand, category] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId } }),
      prisma.brand.findUnique({ where: { id: brandId } }),
      prisma.category.findUnique({ where: { id: categoryId } })
    ]);

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Generate sample data if not provided
    let finalMonthlySales = monthlySales;
    let finalDailySales = dailySales;
    
    if (!monthlySales || !dailySales) {
      const sampleData = generateSampleData(storeId, brandId, categoryId, year);
      finalMonthlySales = monthlySales || sampleData.monthlySales;
      finalDailySales = dailySales || sampleData.dailySales;
    }

    // Check if record exists for this store-brand-category-year combination
    const existingRecord = await prisma.salesRecord.findUnique({
      where: {
        storeId_brandId_categoryId_year: {
          storeId,
          brandId,
          categoryId,
          year
        }
      }
    });

    let salesRecord;

    if (existingRecord) {
      // Update existing record
      salesRecord = await prisma.salesRecord.update({
        where: {
          storeId_brandId_categoryId_year: {
            storeId,
            brandId,
            categoryId,
            year
          }
        },
        data: {
          monthlySales: finalMonthlySales,
          dailySales: finalDailySales
        },
        include: {
          store: { select: { storeName: true, city: true } },
          brand: { select: { brandName: true } },
          category: { select: { brandName: true } }
        }
      });

      return NextResponse.json({
        message: 'Sales record updated successfully',
        action: 'updated',
        salesRecord
      });
    } else {
      // Create new record
      salesRecord = await prisma.salesRecord.create({
        data: {
          storeId,
          brandId,
          categoryId,
          year,
          monthlySales: finalMonthlySales,
          dailySales: finalDailySales
        },
        include: {
          store: { select: { storeName: true, city: true } },
          brand: { select: { brandName: true } },
          category: { select: { brandName: true } }
        }
      });

      return NextResponse.json({
        message: 'Sales record created successfully',
        action: 'created',
        salesRecord
      });
    }

  } catch (error) {
    console.error('Error creating/updating sales record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const year = searchParams.get('year');
    const brandId = searchParams.get('brandId');
    const categoryId = searchParams.get('categoryId');

    // Build where clause
    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (year) where.year = parseInt(year);
    if (brandId) where.brandId = brandId;
    if (categoryId) where.categoryId = categoryId;

    const salesRecords = await prisma.salesRecord.findMany({
      where,
      include: {
        store: { select: { storeName: true, city: true } },
        brand: { select: { brandName: true } },
        category: { select: { brandName: true } }
      },
      orderBy: [
        { year: 'desc' },
        { storeId: 'asc' }
      ]
    });

    return NextResponse.json({
      salesRecords,
      total: salesRecords.length
    });

  } catch (error) {
    console.error('Error fetching sales records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}