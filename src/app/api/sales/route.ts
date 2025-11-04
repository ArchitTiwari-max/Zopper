// app/api/sales-import/route.ts
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const year = searchParams.get('year');
    const brandName = searchParams.get('brandName');
    const categoryName = searchParams.get('categoryName');

    // Build where clause based on provided filters
    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (year) where.year = parseInt(year);
    if (brandName) where.brand = { brandName };
    if (categoryName) where.category = { categoryName };

    const salesRecords = await prisma.salesRecord.findMany({
      where,
      include: {
        store: {
          select: {
            id: true,
            storeName: true,
            city: true
          }
        },
        brand: {
          select: {
            id: true,
            brandName: true
          }
        },
        category: {
          select: {
            id: true,
            categoryName: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { storeId: 'asc' }
      ]
    });

    // Transform the data to match the expected format
    const transformedData = salesRecords.flatMap(record => {
      const monthlySales = Array.isArray(record.monthlySales) ? record.monthlySales : [];
      return monthlySales.map((monthData: any) => ({
        id: `${record.id}-${monthData.month}`,
        storeId: record.storeId,
        storeName: record.store.storeName,
        brandName: record.brand.brandName,
        categoryName: record.category.categoryName,
        year: record.year,
        month: monthData.month,
        deviceSales: monthData.deviceSales || 0,
        planSales: monthData.planSales || 0,
        attachPct: monthData.attachPct || 0,
        revenue: monthData.revenue || 0
      }));
    });

    return NextResponse.json({
      success: true,
      data: transformedData,
      totalRecords: transformedData.length
    });
  } catch (err) {
    console.error('GET /api/sales error:', err);
    return NextResponse.json({ 
      success: false, 
      error: '❌ Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { Store_ID, Brand, Category, ...monthMetrics } = data;
    if (!Store_ID || !Brand || !Category) {
      return NextResponse.json({ error: '⚠️ Missing Store_ID, Brand, or Category' }, { status: 400 });
    }

    // 1. Find store by id
    const store = await prisma.store.findUnique({ where: { id: Store_ID } });
    if (!store) return NextResponse.json({ error: '⚠️ Store not found' }, { status: 400 });

    // 2. Find brand by name
    const brand = await prisma.brand.findUnique({ where: { brandName: Brand } });
    if (!brand) return NextResponse.json({ error: '⚠️ Brand not found' }, { status: 400 });

    // 3. Find category by name
    const category = await prisma.category.findUnique({ where: { categoryName: Category } });
    if (!category) return NextResponse.json({ error: '⚠️ Category not found' }, { status: 400 });

    // 4. Check brand is mapped to store
    if (!store.partnerBrandIds.includes(brand.id)) {
      return NextResponse.json({ error: '⚠️ Brand is not mapped to this store' }, { status: 400 });
    }

    // 5. Check category is mapped to brand
    const catBrand = await prisma.categoryBrand.findUnique({
      where: { brandId_categoryId: { brandId: brand.id, categoryId: category.id } }
    });
    if (!catBrand) {
      return NextResponse.json({ error: '⚠️ Category is not mapped to this brand' }, { status: 400 });
    }

    // 6. Group month-metric keys by year
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

    // 7. Upsert for each year
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

    return NextResponse.json({ message: '✅ Sales data stored successfully' }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '❌ Internal server error' }, { status: 500 });
  }
}
