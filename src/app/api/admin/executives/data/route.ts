import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' }, 
        { status: 403 }
      );
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const executiveId = searchParams.get('executiveId');
    const storeId = searchParams.get('storeId');
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';

    // Build where clause for executives
    let whereClause: any = {};

    // Filter by executive ID (exact match)
    if (executiveId && executiveId !== 'All Executive') {
      whereClause.id = executiveId;
    }

    // Filter by store - if storeId is provided, filter executives who are assigned to that store
    if (storeId && storeId !== 'All Store') {
      // Filter by ExecutiveStoreAssignment relationship
      whereClause.executiveStores = {
        some: {
          storeId: storeId
        }
      };
    }

    // Compute date range for filtering visits
    const now = new Date();
    let startDate: Date;
    switch (dateFilter) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'Last Year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get executives (basic fields)
    const executives = await prisma.executive.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        region: true,
        executiveStores: {
          select: {
            storeId: true,
            assignedAt: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // If there are no executives after filters, return early
    if (executives.length === 0) {
      return NextResponse.json({ executives: [], total: 0 });
    }

    // Fetch visits for these executives within the date range in one query
    const visitsInRange = await prisma.visit.findMany({
      where: {
        executiveId: { in: executives.map(e => e.id) },
        createdAt: { gte: startDate, lte: now }
      },
      select: { executiveId: true, createdAt: true }
    });

    // Aggregate counts and last visit per executive within range
    const visitCountMap = new Map<string, number>();
    const lastVisitMap = new Map<string, Date>();
    for (const v of visitsInRange) {
      visitCountMap.set(v.executiveId, (visitCountMap.get(v.executiveId) || 0) + 1);
      const prev = lastVisitMap.get(v.executiveId);
      if (!prev || prev < v.createdAt) {
        lastVisitMap.set(v.executiveId, v.createdAt as unknown as Date);
      }
    }

    // Process executives data efficiently without individual database calls
    const processedExecutives = executives.map((executive) => {

      // Get initials for avatar
      const initials = executive.name
        .split(' ')
        .map(word => word.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase();

      // Generate consistent avatar color
      const colors = [
        '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#10B981',
        '#EF4444', '#F59E0B', '#6366F1', '#84CC16', '#F43F5E'
      ];
      const colorIndex = executive.name.length % colors.length;

      // Format last visit date to dd/mm/yyyy format (within selected period)
      let formattedLastVisit = 'Never';
      const last = lastVisitMap.get(executive.id);
      if (last) {
        const lastVisitDate = new Date(last);
        formattedLastVisit = `${lastVisitDate.getDate().toString().padStart(2, '0')}/${(lastVisitDate.getMonth() + 1).toString().padStart(2, '0')}/${lastVisitDate.getFullYear()}`;
      }

      return {
        id: executive.id,
        name: executive.name,
        initials: initials,
        region: executive.region || 'Not Assigned',
        totalVisits: visitCountMap.get(executive.id) || 0,
        lastVisit: formattedLastVisit,
        assignedStoreIds: executive.executiveStores.map(es => es.storeId),
        avatarColor: colors[colorIndex]
      };
    });

    return NextResponse.json({
      executives: processedExecutives,
      total: processedExecutives.length
    });

  } catch (error) {
    console.error('Executives Data API Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
