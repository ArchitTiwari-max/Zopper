import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/executive/sales/summary?storeIds=ID1,ID2
// Returns totalRevenue per storeId for the current year
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const storeIdsParam = searchParams.get('storeIds');
    if (!storeIdsParam) {
      return NextResponse.json({ error: 'storeIds query param is required' }, { status: 400 });
    }

    const storeIds = storeIdsParam
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (storeIds.length === 0) {
      return NextResponse.json({ error: 'No valid storeIds provided' }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();

    // Fetch sales records for the given stores in current year
    const records = await prisma.salesRecord.findMany({
      where: {
        storeId: { in: storeIds },
        year: currentYear,
      },
      select: {
        storeId: true,
        monthlySales: true,
      },
    });

    // Aggregate total revenue by storeId
    const totals: Record<string, { totalRevenue: number }> = {};
    for (const id of storeIds) {
      totals[id] = { totalRevenue: 0 };
    }

    for (const rec of records) {
      try {
        const monthly = Array.isArray(rec.monthlySales) ? rec.monthlySales : [];
        const revenueSum = monthly.reduce((sum: number, m: any) => sum + (Number(m?.revenue) || 0), 0);
        totals[rec.storeId].totalRevenue += revenueSum;
      } catch {
        // If parsing fails, skip this record
      }
    }

    const response = NextResponse.json({ success: true, totals, year: currentYear });
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return response;
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    return NextResponse.json({ error: 'Failed to fetch sales summary' }, { status: 500 });
  }
}
