import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';
    const partnerBrand = searchParams.get('partnerBrand');
    const city = searchParams.get('city');
    const storeName = searchParams.get('storeName');
    const storeId = searchParams.get('storeId');
    const executiveName = searchParams.get('executiveName');
    const executiveId = searchParams.get('executiveId');
    const visitStatus = searchParams.get('visitStatus');
    const issueStatus = searchParams.get('issueStatus');

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const isExport = searchParams.get('isExport') === 'true';

    // Calculate date range based on filter
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (dateFilter) {
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

    // Build where clause for visits
    let whereClause: any = {
      visitDate: {
        gte: startDate,
        lte: endDate
      }
    };

    if (storeId && storeId !== 'All Store') {
      whereClause.storeId = storeId;
    } else if (storeName && storeName !== 'All Store' && storeName.trim() !== '') {
      const escapedStoreName = storeName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      whereClause.store = { ...whereClause.store, storeName: { contains: escapedStoreName, mode: 'insensitive' } };
    }

    if (executiveId && executiveId !== 'All Executive') {
      whereClause.executiveId = executiveId;
    } else if (executiveName && executiveName !== 'All Executive' && executiveName.trim() !== '') {
      const escapedExecName = executiveName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      whereClause.executive = { ...whereClause.executive, name: { contains: escapedExecName, mode: 'insensitive' } };
    }

    if (city && city !== 'All City') {
      whereClause.store = { ...whereClause.store, city: city };
    }

    if (visitStatus && visitStatus !== 'All Status') {
      whereClause.status = visitStatus;
    }

    if (issueStatus && issueStatus !== 'All Status') {
      if (issueStatus === 'Pending') {
        whereClause.issues = { some: { status: { in: ['Pending', 'Assigned'] } } };
      } else {
        whereClause.issues = { some: { status: issueStatus } };
      }
    }

    if (partnerBrand && partnerBrand !== 'All Brands') {
      const brandRecord = await prisma.brand.findFirst({ where: { brandName: partnerBrand } });
      if (brandRecord) {
        whereClause.brandIds = { has: brandRecord.id };
      } else {
        // If brand not found, ensure no visits are returned
        whereClause.id = 'invalid_id_brand_not_found';
      }
    }

    // Pagination metrics
    const fetchOptions: any = {
      where: whereClause,
      select: {
        id: true,
        status: true,
        remarks: true,
        brandIds: true,
        visitDate: true,
        createdAt: true,
        POSMchecked: true,
        personMet: true,
        imageUrls: true,
        reviewedAt: true,
        reviewedByAdmin: { select: { id: true, name: true } },
        executive: { select: { id: true, name: true } },
        store: { select: { id: true, storeName: true, city: true } },
        issues: { select: { id: true, details: true, status: true } }
      },
      orderBy: { visitDate: 'desc' }
    };

    if (!isExport) {
      fetchOptions.skip = (page - 1) * limit;
      fetchOptions.take = limit;
    }

    // Run count and data fetching in parallel for maximum performance
    const [totalCount, visits, brands] = await Promise.all([
      prisma.visit.count({ where: whereClause }),
      prisma.visit.findMany(fetchOptions),
      prisma.brand.findMany({ select: { id: true, brandName: true } })
    ]);

    const totalPages = isExport ? 1 : Math.ceil(totalCount / limit);

    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Efficiently fetch the most recent previous visit for each fetched visit
    const prevVisitsPromises = visits.map(v => {
      if (!v.store?.id) return Promise.resolve({ id: v.id, prevDate: null });
      const currentVisitTime = v.visitDate || v.createdAt;
      return prisma.visit.findFirst({
        where: {
          storeId: v.store.id,
          OR: [
            { visitDate: { lt: currentVisitTime } },
            { visitDate: null, createdAt: { lt: currentVisitTime } }
          ]
        },
        orderBy: { visitDate: 'desc' },
        select: { visitDate: true, createdAt: true }
      }).then(res => ({
        id: v.id,
        prevDate: res ? (res.visitDate || res.createdAt) : null
      }));
    });
    
    const prevVisitsResults = await Promise.all(prevVisitsPromises);
    const prevVisitMap = new Map<string, Date | null>(prevVisitsResults.map(r => [r.id, r.prevDate]));

    // Process visit data
    let processedVisits = visits.map((visit) => {
      // Get partner brands
      const partnerBrands = visit.brandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean) as string[];

      // Get executive initials
      const execName = visit.executive?.name || 'Unknown Executive';
      const initials = execName
        .split(' ')
        .map(word => word.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase();

      // Avatar color logic
      const colors = [
        '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#00A3C4', '#3182CE', '#553C9A', '#805AD5',
        '#D53F8C', '#F56500', '#319795', '#2D3748', '#744210', '#065F46', '#1A365D', '#44337A',
        '#97266D', '#C53030', '#B7791F', '#2F855A', '#2B6CB0', '#6B46C1', '#BE185D', '#DC2626',
        '#059669', '#7C3AED'
      ];
      const firstLetter = execName.charAt(0).toUpperCase();
      const colorIndex = firstLetter.charCodeAt(0) - 65;
      const safeColorIndex = Math.max(0, Math.min(colorIndex, colors.length - 1));

      // Process personMet data
      let peopleMet: Array<{name: string, designation: string, phoneNumber?: string}> = [];
      if (visit.personMet && Array.isArray(visit.personMet) && visit.personMet.length > 0) {
        peopleMet = visit.personMet.map((person: any) => ({
          name: person?.name || '',
          designation: person?.designation || '',
          phoneNumber: person?.phoneNumber
        })).filter(person => person.name);
      }

      // Determine issue status
      let issueStatusResult: 'Pending' | 'Assigned' | 'Resolved' | null = null;
      let issues = 'None';
      let issueId: string | undefined;

      if (visit.issues.length > 0) {
        const issue = visit.issues[0];
        issues = issue.details;
        issueId = issue.id;
        issueStatusResult = issue.status as 'Pending' | 'Assigned' | 'Resolved';
      }

      // Format date to dd/mm/yyyy
      const visitDateObj = new Date(visit.visitDate || visit.createdAt);
      const formattedVisitDate = `${visitDateObj.getDate().toString().padStart(2, '0')}/${(visitDateObj.getMonth() + 1).toString().padStart(2, '0')}/${visitDateObj.getFullYear()}`;

      // Get previous visit date
      let prevVisitDateStr = null;
      const prevDate = prevVisitMap.get(visit.id);
      if (prevDate) {
        prevVisitDateStr = `${prevDate.getDate().toString().padStart(2, '0')}/${(prevDate.getMonth() + 1).toString().padStart(2, '0')}/${prevDate.getFullYear()}`;
      }

      return {
        id: visit.id,
        executiveId: visit.executive?.id || 'unknown',
        executiveName: execName,
        executiveInitials: initials,
        avatarColor: colors[safeColorIndex] || colors[0],
        storeName: visit.store?.storeName || 'Unknown Store',
        storeId: visit.store?.id || 'unknown',
        partnerBrand: partnerBrands,
        visitDate: formattedVisitDate,
        previousVisitDate: prevVisitDateStr,
        visitStatus: visit.status as 'PENDING_REVIEW' | 'REVIEWD',
        reviewerName: visit.reviewedByAdmin?.name,
        issueStatus: issueStatusResult,
        city: visit.store?.city || 'Unknown',
        issues: issues,
        issueId: issueId,
        feedback: visit.remarks || 'No feedback provided',
        POSMchecked: visit.POSMchecked,
        peopleMet: peopleMet,
        imageUrls: visit.imageUrls || []
      };
    });

    const response = NextResponse.json({
      visits: processedVisits,
      total: totalCount,
      page,
      limit,
      totalPages
    });
    
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('Visit Report Data API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
