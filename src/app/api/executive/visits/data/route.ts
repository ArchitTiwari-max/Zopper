import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET endpoint to fetch all visits of the authenticated executive (for visit history page)
// API Version: v2 - Added partnerBrand field to response structure
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive data
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Disable caching for My Visits data to always return the latest state

    // Add pagination support
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50'); // Default 50 visits
    const skip = (page - 1) * limit;

    // Add date period filtering
    const period = url.searchParams.get('period') || 'Last 30 Days';
    
    // Calculate date range based on period
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
      case 'This Month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'Last Month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        startDate = lastMonth;
        // For last month, we need both start and end date
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    }

    // Build where clause with date filtering
    const whereClause: any = {
      executiveId: executive.id,
      createdAt: {
        gte: startDate
      }
    };

    // Special handling for "Last Month" - needs both start and end date
    if (period === 'Last Month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      whereClause.createdAt = {
        gte: lastMonth,
        lte: lastMonthEnd
      };
    }

    // Get visits for this executive with date filtering and optimized query
    const visits = await prisma.visit.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        personMet: true,
        POSMchecked: true,
        remarks: true,
        imageUrls: true,
        adminComment: true,
        brandIds: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        reviewedByAdmin: { select: { id: true, name: true } },
        store: {
          select: {
            id: true,
            storeName: true,
            partnerBrandIds: true
          }
        },
        executive: {
          select: {
            id: true,
            name: true
          }
        },
        issues: {
          select: {
            id: true,
            details: true,
            status: true,
            createdAt: true,
            assigned: {
              where: {
                executiveId: executive.id // Only return assignments for this executive
              },
              select: {
                id: true,
                adminComment: true,
                status: true,
                createdAt: true,
                executive: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: skip,
      take: limit
    });

    // Get all unique brand IDs from all visits
    const allBrandIds = [...new Set(
      visits.flatMap(visit => visit.store?.partnerBrandIds || [])
    )];

    // Fetch brand names for all brand IDs
    const brands = allBrandIds.length > 0 ? await prisma.brand.findMany({
      where: {
        id: { in: allBrandIds }
      },
      select: {
        id: true,
        brandName: true
      }
    }) : [];

    // Create a map for quick brand ID to name lookup
    const brandMap = new Map(brands.map(brand => [brand.id, brand.brandName]));

    // Transform visits data
    const transformedVisits = visits.map(visit => ({
      id: visit.id,
      storeName: visit.store?.storeName || 'Unknown Store',
      partnerBrand: visit.store?.partnerBrandIds && visit.store.partnerBrandIds.length > 0 
        ? visit.store.partnerBrandIds.map(brandId => brandMap.get(brandId) || 'Unknown Brand').join(', ')
        : 'N/A',
      status: visit.status,
      reviewerName: visit.reviewedByAdmin?.name,
      representative: visit.executive?.name || 'Unknown Executive',
      personMet: visit.personMet,
      POSMchecked: visit.POSMchecked,
      remarks: visit.remarks,
      imageUrls: visit.imageUrls,
      adminComment: visit.adminComment,
      date: visit.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }), // Add date field for VisitDetailsModal compatibility
      issues: visit.issues.map((issue: any) => ({
        id: issue.id,
        details: issue.details,
        status: issue.status,
        createdAt: issue.createdAt,
        assigned: issue.assigned
          .filter((assignment: any) => assignment.executive) // Filter out null executives
          .map((assignment: any) => ({
            id: assignment.id,
            adminComment: assignment.adminComment,
            status: assignment.status,
            createdAt: assignment.createdAt,
            executiveName: assignment.executive?.name || 'Unknown Executive'
          }))
      })),
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt
    }));

    // Create response with NO caching so UI updates immediately
    const response = NextResponse.json({
      success: true,
      data: transformedVisits
    });

    // Disable caching completely
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie');
    
    return response;

  } catch (error) {
    console.error('Error fetching executive visits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executive visits' },
      { status: 500 }
    );
  }
}
