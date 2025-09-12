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
    const executiveFilterId = searchParams.get('executiveId'); // From filter dropdown
    const urlExecutiveId = searchParams.get('urlExecutiveId'); // From URL navigation
    const storeFilterId = searchParams.get('storeId'); // From filter dropdown
    const urlStoreId = searchParams.get('urlStoreId'); // From URL navigation
    const brandId = searchParams.get('brandId');

    // Build where clause for executives
    let whereClause: any = {};

    // Filter by executive ID (exact match)
    const execId = urlExecutiveId || executiveFilterId;
    if (execId && execId !== 'All Executive') {
      whereClause.id = execId;
    }

    // Filter by store - if storeId is provided, filter executives who are assigned to that store
    const currentStoreId = urlStoreId || storeFilterId;
    if (currentStoreId && currentStoreId !== 'All Store') {
      // Filter by assignedStoreIds array
      whereClause.assignedStoreIds = {
        has: currentStoreId
      };
    }

    // Filter by brand - if brandId is provided, filter executives who have worked with that brand
    if (brandId && brandId !== 'All Brands') {
      // If there's already a store filter, combine with AND logic
      if (whereClause.assignedStoreIds) {
        whereClause.AND = [
          { assignedStoreIds: whereClause.assignedStoreIds },
          {
            visits: {
              some: {
                brandIds: {
                  has: brandId
                }
              }
            }
          }
        ];
        delete whereClause.assignedStoreIds;
      } else {
        whereClause.visits = {
          some: {
            brandIds: {
              has: brandId
            }
          }
        };
      }
    }

    // OPTIMIZED: Get executives, brands, and all visits concurrently with Promise.all
    const [executives, brands, allExecutiveVisits] = await Promise.all([
      // Get executives with latest visit data - no limits, fetch all data
      prisma.executive.findMany({
        where: whereClause,
        include: {
          visits: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1, // Get latest visit for last visit date
            select: {
              createdAt: true,
              brandIds: true
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
      }),

      // Get ALL brands for brand mapping - no limits
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true
        }
      }),

      // Get ALL visits with brand data for all executives at once - no limits
      prisma.visit.findMany({
        where: whereClause.id ? {
          executiveId: whereClause.id
        } : {}, // If filtering by specific executive, only get their visits, otherwise get all
        select: {
          executiveId: true,
          brandIds: true
        }
      })
    ]);
    // Create lookup maps for better performance
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));
    
    // Build executive-brands map from bulk visit data
    const executiveBrandsMap = new Map<string, Set<string>>();
    allExecutiveVisits.forEach(visit => {
      if (!executiveBrandsMap.has(visit.executiveId)) {
        executiveBrandsMap.set(visit.executiveId, new Set());
      }
      const brandSet = executiveBrandsMap.get(visit.executiveId)!;
      visit.brandIds.forEach(brandId => brandSet.add(brandId));
    });

    // Process executives data efficiently without individual database calls
    const processedExecutives = executives.map((executive) => {
      // Get all unique brands this executive has worked with from bulk data
      const uniqueBrandIds = Array.from(executiveBrandsMap.get(executive.id) || new Set());

      const partnerBrands = uniqueBrandIds
        .map((brandId: unknown) => brandMap.get(brandId as string))
        .filter(Boolean) as string[];

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

      return {
        id: executive.id,
        name: executive.name,
        initials: initials,
        region: executive.region || 'Not Assigned',
        partnerBrands: partnerBrands, // Show ALL brands, no limit
        totalVisits: executive._count.visits,
        lastVisit: executive.visits[0]?.createdAt 
          ? new Date(executive.visits[0].createdAt).toISOString().split('T')[0]
          : 'Never',
        assignedStores: 'View All',
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
