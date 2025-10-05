import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const brandName = searchParams.get('brandName');
    const categoryName = searchParams.get('categoryName');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

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

    // Transform the data to extract daily sales from grouped monthly object
    const transformedData = salesRecords.flatMap(record => {
      const dailyByMonth = (record.dailySales || {}) as Record<string, any[]>; // { "1": [...], ... }

      const out: any[] = [];
      const targetMonth = month ? parseInt(month) : null;

      for (const [monthKey, entries] of Object.entries(dailyByMonth)) {
        const m = parseInt(monthKey, 10);
        if (targetMonth && m !== targetMonth) continue;
        if (!Array.isArray(entries)) continue;

        for (const d of entries) {
          const ds = String(d.date || "");
          if (!ds) continue;
          // ds is DD-MM-YYYY -> convert to ISO YYYY-MM-DD for stable sorting
          const [dd, mm, yyyy] = ds.split('-');
          const iso = `${yyyy}-${mm}-${dd}`;

          out.push({
            id: `${record.id}-${iso}`,
            storeId: record.storeId,
            storeName: record.store.storeName,
            brandName: record.brand.brandName,
            categoryName: record.category.categoryName,
            year: record.year,
            date: iso,
            countOfSales: Number(d.countOfSales || 0),
            revenue: Number(d.revenue || 0),
            displayDate: `${dd}-${mm}-${yyyy}`
          });
        }
      }

      return out;
    });

    // Sort by date descending (ISO dates)
    transformedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      data: transformedData,
      totalRecords: transformedData.length
    });
  } catch (err) {
    console.error('GET /api/sales/daily error:', err);
    return NextResponse.json({ 
      success: false, 
      error: '❌ Internal server error' 
    }, { status: 500 });
  }
}

// Helper retained for backward compatibility but not used for DD-MM-YYYY input
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
