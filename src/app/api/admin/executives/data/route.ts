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

    // Build where clause for executives
    let whereClause: any = {};

    // Filter by executive ID (exact match)
    if (executiveId && executiveId !== 'All Executive') {
      whereClause.id = executiveId;
    }

    // Filter by store - if storeId is provided, filter executives who are assigned to that store
    if (storeId && storeId !== 'All Store') {
      // Filter by assignedStoreIds array
      whereClause.assignedStoreIds = {
        has: storeId
      };
    }

    // OPTIMIZED: Get executives data
    const executives = await prisma.executive.findMany({
      where: whereClause,
      include: {
        visits: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1, // Get latest visit for last visit date
          select: {
            createdAt: true
          }
        },
        _count: {
          select: {
            visits: true
          }
        }
      },
      orderBy: [
        {
          visits: {
            _count: 'desc' // Order by most visits first
          }
        },
        {
          name: 'asc'
        }
      ]
    });

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

      // Format last visit date to dd/mm/yyyy format
      let formattedLastVisit = 'Never';
      if (executive.visits[0]?.createdAt) {
        const lastVisitDate = new Date(executive.visits[0].createdAt);
        formattedLastVisit = `${lastVisitDate.getDate().toString().padStart(2, '0')}/${(lastVisitDate.getMonth() + 1).toString().padStart(2, '0')}/${lastVisitDate.getFullYear()}`;
      }

      return {
        id: executive.id,
        name: executive.name,
        initials: initials,
        region: executive.region || 'Not Assigned',
        totalVisits: executive._count.visits,
        lastVisit: formattedLastVisit,
        assignedStoreIds: executive.assignedStoreIds || [],
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
