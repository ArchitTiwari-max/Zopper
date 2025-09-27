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

    // Transform the data to extract daily sales
    const transformedData = salesRecords.flatMap(record => {
      const dailySales = Array.isArray(record.dailySales) ? record.dailySales : [];
      
      return dailySales
        .filter((dailyData: any) => {
          // Filter by month if specified
          if (month) {
            const date = new Date(dailyData.date);
            return date.getMonth() + 1 === parseInt(month);
          }
          return true;
        })
        .map((dailyData: any) => ({
          id: `${record.id}-${dailyData.date}`,
          storeId: record.storeId,
          storeName: record.store.storeName,
          brandName: record.brand.brandName,
          categoryName: record.category.categoryName,
          year: record.year,
          date: dailyData.date,
          countOfSales: dailyData.countOfSales || 0,
          revenue: dailyData.revenue || 0,
          // Format date for display
          displayDate: formatDate(dailyData.date)
        }));
    });

    // Sort by date descending
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

// Helper function to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}