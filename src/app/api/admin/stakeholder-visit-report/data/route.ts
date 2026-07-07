import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';
    const executiveId = searchParams.get('executiveId');
    const designation = searchParams.get('designation');
    const visitStatus = searchParams.get('visitStatus');
    const brandId = searchParams.get('brandId');
    const state = searchParams.get('state');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const isExport = searchParams.get('isExport') === 'true';

    // Date range
    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (dateFilter) {
      case 'All Time': break;
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        endDate.setMilliseconds(-1);
        break;
      case 'Yesterday':
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        startDate = yesterday;
        endDate = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'Last Year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    const whereClause: any = {};
    if (startDate && endDate) {
      whereClause.visitDate = { gte: startDate, lte: endDate };
    }
    if (executiveId && executiveId !== 'All Executive') {
      whereClause.executiveId = executiveId;
    }
    if (designation && designation !== 'All Designation') {
      whereClause.stakeholderDesignation = { contains: designation, mode: 'insensitive' };
    }
    if (visitStatus && visitStatus !== 'All Status') {
      whereClause.status = visitStatus;
    }
    if (brandId && brandId !== 'all') {
      whereClause.brandId = brandId;
    }
    if (state && state !== 'all') {
      whereClause.state = state;
    }

    const fetchOptions: any = {
      where: whereClause,
      select: {
        id: true,
        brandId: true,
        brand: { select: { brandName: true } },
        stakeholderDesignation: true,
        state: true,
        visitDate: true,
        personMet: true,
        remarks: true,
        imageUrls: true,
        nextScheduledDate: true,
        status: true,
        adminComment: true,
        reviewedAt: true,
        createdAt: true,
        reviewedByEmployee: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        stakeholder: { select: { brands: true } },
        issues: { select: { id: true, details: true, status: true, assigned: { include: { employee: { select: { name: true } } } } } },
      },
      orderBy: { visitDate: 'desc' },
    };

    if (!isExport) {
      fetchOptions.skip = (page - 1) * limit;
      fetchOptions.take = limit;
    }

    const [totalCount, visits] = await Promise.all([
      prisma.stakeholderVisit.count({ where: whereClause }),
      prisma.stakeholderVisit.findMany(fetchOptions),
    ]);

    const totalPages = isExport ? 1 : Math.ceil(totalCount / limit);

    // Avatar color helper
    const colors = [
      '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#00A3C4', '#3182CE', '#553C9A', '#805AD5',
      '#D53F8C', '#F56500', '#319795', '#2D3748', '#744210', '#065F46', '#1A365D', '#44337A',
    ];

    const processedVisits = (visits as any[]).map((visit) => {
      const execName = visit.employee?.name || 'Unknown Executive';
      const initials = execName.split(' ').map((w: string) => w.charAt(0)).slice(0, 2).join('').toUpperCase();
      const colorIndex = Math.max(0, Math.min(execName.charCodeAt(0) - 65, colors.length - 1));

      let peopleMet: Array<{ name: string; designation: string; phoneNumber?: string }> = [];
      if (visit.personMet && Array.isArray(visit.personMet)) {
        peopleMet = visit.personMet.map((p: any) => ({
          name: p?.name || '',
          designation: p?.designation || '',
          phoneNumber: p?.phoneNumber,
        })).filter((p: any) => p.name);
      }

      const visitDateObj = new Date(visit.visitDate || visit.createdAt);
      const formattedVisitDate = `${visitDateObj.getDate().toString().padStart(2, '0')}/${(visitDateObj.getMonth() + 1).toString().padStart(2, '0')}/${visitDateObj.getFullYear()}`;

      let nextScheduledDateStr = null;
      if (visit.nextScheduledDate) {
        const d = new Date(visit.nextScheduledDate);
        nextScheduledDateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      }

      return {
        id: visit.id,
        executiveId: visit.employee?.id || 'unknown',
        executiveName: execName,
        executiveInitials: initials,
        avatarColor: colors[colorIndex] || colors[0],
        brandName: visit.brand?.brandName || 'Unknown Brand',
        stakeholderDesignation: visit.stakeholderDesignation,
        state: visit.state || 'N/A',
        visitDate: formattedVisitDate,
        nextScheduledDate: nextScheduledDateStr,
        visitStatus: visit.status as 'PENDING_REVIEW' | 'REVIEWD',
        reviewerName: visit.reviewedByEmployee?.name,
        feedback: visit.remarks || 'No feedback provided',
        peopleMet,
        imageUrls: visit.imageUrls || [],
        brands: visit.stakeholder?.brands || [],
        issues: visit.issues || [],
      };
    });

    // Fetch filter options (all brands, states, designations from all visits)
    const allForFilters = await prisma.stakeholderVisit.findMany({
      select: { brandId: true, brand: { select: { brandName: true } }, state: true, stakeholderDesignation: true },
    });
    const brandsMap = new Map<string, string>();
    const statesSet = new Set<string>();
    const designationsSet = new Set<string>();
    for (const v of allForFilters as any[]) {
      if (v.brandId && v.brand?.brandName) brandsMap.set(v.brandId, v.brand.brandName);
      if (v.state) statesSet.add(v.state);
      if (v.stakeholderDesignation) designationsSet.add(v.stakeholderDesignation);
    }
    const allBrands = Array.from(brandsMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    const allStates = Array.from(statesSet).sort();
    const allDesignations = Array.from(designationsSet).sort();

    const response = NextResponse.json({
      visits: processedVisits,
      total: totalCount,
      page,
      limit,
      totalPages,
      allBrands,
      allStates,
      allDesignations,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Stakeholder Visit Report API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
