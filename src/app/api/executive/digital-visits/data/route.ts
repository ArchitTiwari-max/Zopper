import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET: list digital visits for the authenticated executive with date period filtering
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.roles.includes('EXECUTIVE')) return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });

    const exec = await prisma.employee.findUnique({ where: { userId: user.userId } });
    if (!exec) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'Last 30 Days';

    // Compute date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const visits = await prisma.digitalVisit.findMany({
      where: { executiveId: exec.id, connectDate: { gte: startDate } },
      select: {
        id: true,
        status: true,
        personMet: true,
        remarks: true,
        adminComment: true,
        connectDate: true,
        createdAt: true,
        updatedAt: true,
        reviewedByEmployee: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        store: {
          select: {
            id: true,
            storeName: true,
            storeBrands: {
              select: { brandId: true }
            }
          }
        },
        issues: { select: { id: true, details: true, status: true, createdAt: true } },
        brandVisitDetails: true,
      },
      orderBy: { connectDate: 'desc' },
    });

    // Build brand map
    const allBrandIds = [...new Set(visits.flatMap(v => v.store?.storeBrands.map(sb => sb.brandId) || []))];
    const brands = allBrandIds.length ? await prisma.brand.findMany({ where: { id: { in: allBrandIds } }, select: { id: true, brandName: true } }) : [];
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    const data = visits.map(v => ({
      id: v.id,
      storeName: v.store?.storeName || 'Unknown Store',
      partnerBrand: (v.store?.storeBrands || []).map(sb => brandMap.get(sb.brandId) || 'Unknown Brand').join(', ') || 'N/A',
      status: v.status as any,
      reviewerName: v.reviewedByEmployee?.name,
      representative: v.employee?.name || 'Unknown Executive',
      personMet: Array.isArray(v.personMet) ? (v.personMet as any[]).map(p => ({ name: p?.name || '', designation: p?.designation || '' })) : [],
      POSMchecked: null,
      remarks: v.remarks || '',
      imageUrls: [],
      adminComment: v.adminComment || '',
      brandVisitDetails: v.brandVisitDetails || null,
      date: v.connectDate?.toISOString?.() || v.connectDate,
      issues: (v.issues || []).map(i => ({ 
        id: i.id, 
        details: i.details, 
        status: i.status as any, 
        createdAt: (i as any)?.createdAt?.toISOString?.() || (i as any)?.createdAt,
        assigned: []
      })),
      createdAt: v.connectDate?.toISOString?.() || v.connectDate,
      updatedAt: (v as any)?.updatedAt?.toISOString?.() || v.updatedAt,
    }));

    const res = NextResponse.json({ success: true, data });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  } catch (e) {
    console.error('Exec digital visits list error:', e);
    return NextResponse.json({ error: 'Failed to fetch digital visits' }, { status: 500 });
  }
}
