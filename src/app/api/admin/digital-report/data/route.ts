import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

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

    // Date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    switch (dateFilter) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        endDate.setMilliseconds(-1);
        break;
      case 'Yesterday': {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        startDate = y; endDate = new Date(y.getTime() + 24 * 60 * 60 * 1000 - 1); break; }
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
      case 'Last Year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
    }

    const whereClause: any = { connectDate: { gte: startDate, lte: endDate } };
    if (storeId) whereClause.storeId = storeId;
    else if (storeName && storeName !== 'All Store') {
      const escapedStoreName = storeName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      whereClause.store = { ...whereClause.store, storeName: { contains: escapedStoreName, mode: 'insensitive' } };
    }
    if (executiveId) whereClause.executiveId = executiveId;
    else if (executiveName && executiveName !== 'All Executive') {
      const escapedExecName = executiveName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      whereClause.executive = { ...whereClause.executive, name: { contains: escapedExecName, mode: 'insensitive' } };
    }
    if (city && city !== 'All City') whereClause.store = { ...whereClause.store, city: city };
    if (visitStatus && visitStatus !== 'All Status') whereClause.status = visitStatus;
    if (issueStatus && issueStatus !== 'All Status') {
      if (issueStatus === 'Pending') whereClause.issues = { some: { status: { in: ['Pending', 'Assigned'] } } };
      else whereClause.issues = { some: { status: issueStatus } };
    }
    
    if (partnerBrand && partnerBrand !== 'All Brands') {
      const brandRecord = await prisma.brand.findFirst({ where: { brandName: partnerBrand } });
      if (brandRecord) {
        whereClause.store = { ...whereClause.store, partnerBrandIds: { has: brandRecord.id } };
      } else {
        whereClause.id = 'invalid_id_brand_not_found';
      }
    }

    const fetchOptions: any = {
      where: whereClause,
      select: {
        id: true,
        status: true,
        remarks: true,
        connectDate: true,
        personMet: true,
        reviewedByAdmin: { select: { id: true, name: true } },
        executive: { select: { id: true, name: true } },
        store: { select: { id: true, storeName: true, city: true, partnerBrandIds: true } },
        issues: { select: { id: true, details: true, status: true } },
      },
      orderBy: { connectDate: 'desc' },
    };

    if (!isExport) {
      fetchOptions.skip = (page - 1) * limit;
      fetchOptions.take = limit;
    }

    // Run count and data fetching in parallel for maximum performance
    const [totalCount, digitalVisits, brands] = await Promise.all([
      prisma.digitalVisit.count({ where: whereClause }),
      prisma.digitalVisit.findMany(fetchOptions),
      prisma.brand.findMany({ select: { id: true, brandName: true } }),
    ]);

    const totalPages = isExport ? 1 : Math.ceil(totalCount / limit);

    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    let processed = digitalVisits.map((v) => {
      const partnerBrands = (v.store?.partnerBrandIds || []).map((id: string) => brandMap.get(id)).filter(Boolean) as string[];
      const execName = v.executive?.name || 'Unknown Executive';
      const initials = execName.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      const avatarColor = '#2563eb';

      let peopleMet: Array<{name: string, designation: string, phoneNumber?: string}> = [];
      if (Array.isArray(v.personMet)) {
        peopleMet = (v.personMet as any[]).map(p => ({ name: p?.name || '', designation: p?.designation || '', phoneNumber: p?.phoneNumber })).filter(p => p.name);
      }

      let issueStatus: 'Pending' | 'Assigned' | 'Resolved' | null = null;
      let issues = 'None';
      let issueId: string | undefined;
      if (v.issues.length > 0) {
        const issue = v.issues[0];
        issues = issue.details; issueId = issue.id; issueStatus = issue.status as any;
      }

      const d = new Date(v.connectDate);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const formattedDate = `${dd}/${mm}/${yyyy}`;

      return {
        id: v.id,
        executiveId: v.executive?.id || 'unknown',
        executiveName: execName,
        executiveInitials: initials,
        avatarColor,
        storeName: v.store?.storeName || 'Unknown Store',
        storeId: v.store?.id || 'unknown',
        partnerBrand: partnerBrands,
        visitDate: formattedDate,
        visitStatus: v.status as 'PENDING_REVIEW' | 'REVIEWD',
        reviewerName: v.reviewedByAdmin?.name,
        issueStatus,
        city: v.store?.city || 'Unknown City',
        issues,
        issueId,
        feedback: v.remarks || 'No feedback provided',
        POSMchecked: null,
        peopleMet,
        imageUrls: [],
      };
    });

    const res = NextResponse.json({ visits: processed, total: totalCount, page, limit, totalPages });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  } catch (e) {
    console.error('Digital Report Data API Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
