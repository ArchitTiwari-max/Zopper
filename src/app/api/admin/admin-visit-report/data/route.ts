import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';
    const partnerBrand = searchParams.get('partnerBrand');
    const city = searchParams.get('city');
    const storeName = searchParams.get('storeName');
    const storeId = searchParams.get('storeId');
    const adminName = searchParams.get('executiveName'); // mapped to executiveName in UI for component reuse
    const adminId = searchParams.get('executiveId');

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

    let whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (storeId && storeId !== 'All Store') whereClause.storeId = storeId;
    if (adminId && !['All Admin', 'All Executive'].includes(adminId)) whereClause.adminId = adminId;

    const [visits, brands] = await Promise.all([
      prisma.adminVisit.findMany({
        where: whereClause,
        select: {
          id: true,
          remarks: true,
          brandIds: true,
          createdAt: true,
          POSMchecked: true,
          personMet: true,
          imageUrls: true,
          admin: {
            select: { id: true, name: true }
          },
          store: {
            select: { id: true, storeName: true, city: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.brand.findMany({ select: { id: true, brandName: true } })
    ]);

    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    let processedVisits = visits.map((visit) => {
      const partnerBrands = (visit.brandIds || []).map(brandId => brandMap.get(brandId)).filter(Boolean) as string[];
      const execName = visit.admin?.name || 'Unknown Admin';
      const initials = execName.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();

      const colors = ['#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#00A3C4', '#3182CE', '#553C9A', '#805AD5', '#D53F8C', '#F56500', '#319795', '#2D3748', '#744210', '#065F46', '#1A365D', '#44337A', '#97266D', '#C53030', '#B7791F', '#2F855A', '#2B6CB0', '#6B46C1', '#BE185D', '#DC2626', '#059669', '#7C3AED'];
      const colorIndex = execName.charAt(0).toUpperCase().charCodeAt(0) - 65;
      const safeColorIndex = Math.max(0, Math.min(colorIndex, colors.length - 1));

      let peopleMet: Array<{ name: string, designation: string, phoneNumber?: string }> = [];
      if (visit.personMet && Array.isArray(visit.personMet) && visit.personMet.length > 0) {
        peopleMet = (visit.personMet as any[]).map(person => ({
          name: person?.name || '',
          designation: person?.designation || '',
          phoneNumber: person?.phoneNumber
        })).filter(person => person.name);
      }

      const visitDate = new Date(visit.createdAt);
      const formattedVisitDate = `${visitDate.getDate().toString().padStart(2, '0')}/${(visitDate.getMonth() + 1).toString().padStart(2, '0')}/${visitDate.getFullYear()}`;

      return {
        id: visit.id,
        executiveId: visit.admin?.id || 'unknown',
        executiveName: execName,
        executiveInitials: initials,
        avatarColor: colors[safeColorIndex],
        storeName: visit.store?.storeName || 'Unknown Store',
        storeId: visit.store?.id || 'unknown',
        partnerBrand: partnerBrands,
        visitDate: formattedVisitDate,
        visitStatus: 'REVIEWD' as any,
        reviewerName: undefined,
        issueStatus: null,
        city: visit.store?.city || '',
        issues: 'None',
        issueId: undefined,
        feedback: visit.remarks || 'No feedback provided',
        POSMchecked: visit.POSMchecked,
        peopleMet: peopleMet,
        imageUrls: visit.imageUrls || []
      };
    });

    if (partnerBrand && partnerBrand !== 'All Brands') processedVisits = processedVisits.filter(v => v.partnerBrand.includes(partnerBrand));
    if (city && city !== 'All City') processedVisits = processedVisits.filter(v => v.city === city);
    if (storeName && storeName !== 'All Store' && !storeId) processedVisits = processedVisits.filter(v => v.storeName.toLowerCase().includes(storeName.toLowerCase()));
    if (adminName && adminName !== 'All Executive' && !adminId) processedVisits = processedVisits.filter(v => v.executiveName.toLowerCase().includes(adminName.toLowerCase()));

    const response = NextResponse.json({ visits: processedVisits, total: processedVisits.length });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Visit Report Data API Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
