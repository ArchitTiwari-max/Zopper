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
    if (executiveId) whereClause.executiveId = executiveId;

    const [digitalVisits, brands] = await Promise.all([
      prisma.digitalVisit.findMany({
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
      }),
      prisma.brand.findMany({ select: { id: true, brandName: true } }),
    ]);

    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    let processed = digitalVisits.map((v) => {
      const partnerBrands = (v.store.partnerBrandIds || []).map((id: string) => brandMap.get(id)).filter(Boolean) as string[];
      const initials = v.executive.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      const avatarColor = '#2563eb';

      // People met
      let peopleMet: Array<{name: string, designation: string, phoneNumber?: string}> = [];
      if (Array.isArray(v.personMet)) {
        peopleMet = (v.personMet as any[]).map(p => ({ name: p?.name || '', designation: p?.designation || '', phoneNumber: p?.phoneNumber })).filter(p => p.name);
      }

      // Issues
      let issueStatus: 'Pending' | 'Assigned' | 'Resolved' | null = null;
      let issues = 'None';
      let issueId: string | undefined;
      if (v.issues.length > 0) {
        const issue = v.issues[0];
        issues = issue.details; issueId = issue.id; issueStatus = issue.status as any;
      }

      const d = v.connectDate;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const formattedDate = `${dd}/${mm}/${yyyy}`;

      return {
        id: v.id,
        executiveId: v.executive.id,
        executiveName: v.executive.name,
        executiveInitials: initials,
        avatarColor,
        storeName: v.store.storeName,
        storeId: v.store.id,
        partnerBrand: partnerBrands,
        visitDate: formattedDate,
        visitStatus: v.status as 'PENDING_REVIEW' | 'REVIEWD',
        reviewerName: v.reviewedByAdmin?.name,
        issueStatus,
        city: v.store.city,
        issues,
        issueId,
        feedback: v.remarks || 'No feedback provided',
        POSMchecked: null,
        peopleMet,
        imageUrls: [],
      };
    });

    // Extra filters on processed
    if (partnerBrand && partnerBrand !== 'All Brands') processed = processed.filter(v => v.partnerBrand.includes(partnerBrand));
    if (city && city !== 'All City') processed = processed.filter(v => v.city === city);
    if (storeName && storeName !== 'All Store' && !storeId) processed = processed.filter(v => v.storeName.toLowerCase().includes(storeName.toLowerCase()));
    if (executiveName && executiveName !== 'All Executive' && !executiveId) processed = processed.filter(v => v.executiveName.toLowerCase().includes(executiveName.toLowerCase()));
    if (visitStatus && visitStatus !== 'All Status') processed = processed.filter(v => v.visitStatus === visitStatus);
    if (issueStatus && issueStatus !== 'All Status') {
      processed = processed.filter(v => issueStatus === 'Pending' ? (v.issueStatus === 'Pending' || v.issueStatus === 'Assigned') : v.issueStatus === issueStatus);
    }

    const res = NextResponse.json({ visits: processed, total: processed.length });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  } catch (e) {
    console.error('Digital Report Data API Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
