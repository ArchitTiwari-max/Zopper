import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

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
    const partnerBrand = searchParams.get('partnerBrand');
    const city = searchParams.get('city');
    const storeFilterId = searchParams.get('storeId'); // From filter dropdown
    const urlStoreId = searchParams.get('urlStoreId'); // From URL navigation
    const executiveFilterId = searchParams.get('executiveId'); // From filter dropdown
    const urlExecutiveId = searchParams.get('urlExecutiveId'); // From URL navigation
    const visitStatus = searchParams.get('visitStatus');
    const issueStatus = searchParams.get('issueStatus');
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';

    // Generate ETag for cache validation (2-minute intervals)
    const currentTime = Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000);
    const cacheKey = JSON.stringify({ 
      partnerBrand, city, storeFilterId, urlStoreId, 
      executiveFilterId, urlExecutiveId, visitStatus, issueStatus, dateFilter 
    });
    const crypto = await import('crypto');
    const paramsHash = crypto.createHash('md5').update(cacheKey).digest('hex');
    const etag = `"${currentTime}-admin-stores-${paramsHash}"`;
    
    // Check if client has cached version (conditional request)
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { 
        status: 304,
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=60',
          'ETag': etag
        }
      });
    }

    // Build where clause for stores
    let whereClause: any = {};

    // Add direct ID filters to the database query for better performance
    if (urlStoreId || (storeFilterId && storeFilterId !== 'All Store')) {
      whereClause.id = urlStoreId || storeFilterId;
    }

    if (city && city !== 'All City') {
      whereClause.city = city;
    }

    // Add executive filtering to the database query for better performance
    if (urlExecutiveId || (executiveFilterId && executiveFilterId !== 'All Executive')) {
      const execId = urlExecutiveId || executiveFilterId;
      
      // Find stores assigned to this executive ID (only if execId is not null)
      if (execId) {
        const executiveStores = await prisma.executiveStoreAssignment.findMany({
          where: { executiveId: execId },
          select: { storeId: true }
        });
        
        if (executiveStores.length > 0) {
          const assignedStoreIds = executiveStores.map(es => es.storeId);
          const currentStoreFilter = urlStoreId || storeFilterId;
          
          if (currentStoreFilter && currentStoreFilter !== 'All Store') {
            // If both executive and store are specified, check if the store is assigned to the executive
            if (assignedStoreIds.includes(currentStoreFilter)) {
              // Keep the existing store filter as the executive is assigned to this store
              // whereClause.id is already set above
            } else {
              // Store is not assigned to this executive, return no results
              whereClause.id = 'no-stores-found';
            }
          } else {
            // If only executive is specified, show all stores assigned to them
            whereClause.id = {
              in: assignedStoreIds
            };
          }
        } else {
          // If executive not found or has no assigned stores, return empty result
          whereClause.id = 'no-stores-found';
        }
      }
    }

    // Resolve date range from dateFilter
    const now = new Date();
    let startDate: Date;
    switch (dateFilter) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
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

    // OPTIMIZED: Get stores, brands, and executives concurrently with Promise.all
    const [stores, brands, allExecutives] = await Promise.all([
      // Get stores with related data - no limits, fetch all data
      prisma.store.findMany({
        where: whereClause,
        include: {
          visits: {
            orderBy: {
              createdAt: 'desc' // Order visits by most recent first
            },
            select: {
              id: true,
              executiveId: true,
              createdAt: true,
              status: true,
              executive: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              visits: true
            }
          }
        }
      }),

      // Get ALL brands for brand filtering - no limits
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true
        }
      }),

      // Get ALL executives with their store assignments - no limits
      prisma.executive.findMany({
        select: {
          id: true,
          name: true,
          executiveStores: {
            select: {
              storeId: true
            }
          }
        }
      })
    ]);

    // Create lookup maps for better performance
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));
    const executiveMap = new Map(allExecutives.map(e => [e.id, e.name]));
    const executiveStoreMap = new Map<string, string>(); // storeId -> executiveName
    
    // Build executive-store assignment map
    allExecutives.forEach(exec => {
      exec.executiveStores.forEach(es => {
        executiveStoreMap.set(es.storeId, exec.name);
      });
    });

    // OPTIMIZED: Get all store statistics in bulk with Promise.all - simplified approach
    const storeIds = stores.map(s => s.id);
    const [allPendingIssues, allRecentVisits, visitStatusData, issueStatusData] = await Promise.all([
      // Get pending issues within selected date range for all stores at once
      prisma.issue.findMany({
        where: {
          visit: {
            storeId: { in: storeIds }
          },
          status: { in: ['Pending', 'Assigned'] },
          createdAt: {
            gte: startDate,
            lte: now
          }
        },
        select: {
          id: true,
          visit: {
            select: {
              storeId: true
            }
          }
        }
      }).then(results => {
        const issueCountMap = new Map<string, number>();
        results.forEach(issue => {
          const storeId = issue.visit.storeId;
          issueCountMap.set(storeId, (issueCountMap.get(storeId) || 0) + 1);
        });
        return issueCountMap;
      }),

      // Get total visits within selected date range for all stores at once
      prisma.visit.findMany({
        where: {
          storeId: { in: storeIds },
          createdAt: {
            gte: startDate,
            lte: now
          }
        },
        select: { storeId: true }
      }).then(results => {
        const recentVisitMap = new Map<string, number>();
        results.forEach(visit => {
          const storeId = visit.storeId;
          recentVisitMap.set(storeId, (recentVisitMap.get(storeId) || 0) + 1);
        });
        return recentVisitMap;
      }),

      // Get visit status data if filtering - simplified
      visitStatus && visitStatus !== 'All Status' ? prisma.visit.findMany({
        where: {
          storeId: { in: storeIds },
          status: visitStatus as any
        },
        select: { storeId: true }
      }).then(results => new Set(results.map(r => r.storeId))) : Promise.resolve(null),

      // Get issue status data if filtering - simplified
      issueStatus && issueStatus !== 'All Status' ? (() => {
        let issueStatusFilter: string[];
        if (issueStatus === 'Pending') {
          issueStatusFilter = ['Pending', 'Assigned'];
        } else if (issueStatus === 'Resolved') {
          issueStatusFilter = ['Resolved'];
        } else {
          issueStatusFilter = [issueStatus];
        }
        
        return prisma.issue.findMany({
          where: {
            visit: { storeId: { in: storeIds } },
            status: { in: issueStatusFilter as any }
          },
          select: {
            visit: {
              select: { storeId: true }
            }
          }
        }).then(results => new Set(results.map(r => r.visit.storeId)));
      })() : Promise.resolve(null)
    ]);

    // Process stores data efficiently without individual database calls
    const processedStores = stores.map((store) => {
      // Get partner brands for this store
      const partnerBrands = store.partnerBrandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean) as string[];

      // Apply brand filter if specified
      if (partnerBrand && partnerBrand !== 'All Brands') {
        if (!partnerBrands.includes(partnerBrand)) {
          return null; // Filter out this store
        }
      }

      // Apply visit status filter if specified
      if (visitStatus && visitStatus !== 'All Status' && visitStatusData) {
        if (!visitStatusData.has(store.id)) {
          return null; // Filter out this store
        }
      }

      // Apply issue status filter if specified
      if (issueStatus && issueStatus !== 'All Status' && issueStatusData) {
        if (!issueStatusData.has(store.id)) {
          return null; // Filter out this store
        }
      }

      // Get statistics from bulk queries
      const pendingIssues = allPendingIssues.get(store.id) || 0;
      const recentVisits = allRecentVisits.get(store.id) || 0;
      const storeStatus = recentVisits > 0 ? 'Active' : 'Inactive';

      // Get assigned executive from pre-built map
      const assignedExecutive = executiveStoreMap.get(store.id) || 'Not Assigned';
        
      // Get last visit date from visits (already fetched with store data)
      let lastVisitDate: Date | null = null;
      if (store.visits.length > 0) {
        const recentVisit = store.visits[0];
        lastVisitDate = new Date(recentVisit.createdAt);
      }

      // Build {name,type} pairs aligned by index
      const partnerBrandPairs = (store.partnerBrandIds || []).map((id, idx) => ({
        id,
        name: brandMap.get(id) || 'Unknown Brand',
        type: (store as any).partnerBrandTypes?.[idx] || null
      }));

      return {
        id: store.id,
        storeName: store.storeName,
        partnerBrands: partnerBrands,
        partnerBrandPairs: partnerBrandPairs,
        address: store.fullAddress || `${store.city}`,
        contactPerson: 'Store Manager', // This info is not in schema, using placeholder
        assignedTo: assignedExecutive,
        pendingReviews: store.visits.filter(v => v.status === 'PENDING_REVIEW').length,
        // Date-filtered metrics
        pendingIssues: pendingIssues,
        totalVisits: allRecentVisits.get(store.id) || 0,
        city: store.city,
        status: storeStatus,
        lastVisit: lastVisitDate ? lastVisitDate.toISOString() : null,
        lastVisitDate: lastVisitDate // Add for sorting
      };
    });

    // Filter out null values (stores that didn't match filters)
    let filteredStores = processedStores.filter(store => store !== null);

    // Sort stores by most recent visit first (stores with recent visits first)
    filteredStores.sort((a, b) => {
      // If both have visits, sort by most recent visit date
      if (a.lastVisitDate && b.lastVisitDate) {
        return b.lastVisitDate.getTime() - a.lastVisitDate.getTime();
      }
      // If only one has visits, prioritize the one with visits
      if (a.lastVisitDate && !b.lastVisitDate) return -1;
      if (!a.lastVisitDate && b.lastVisitDate) return 1;
      // If neither has visits, sort alphabetically by store name
      return a.storeName.localeCompare(b.storeName);
    });

    // Remove lastVisitDate from response as it's only used for sorting
    const finalStores = filteredStores.map(({ lastVisitDate, ...store }) => store);

    const response = NextResponse.json({
      stores: finalStores,
      total: finalStores.length
    });
    
    // Add secure caching headers
    response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');
    response.headers.set('Vary', 'Authorization');
    response.headers.set('ETag', etag);
    
    return response;

  } catch (error) {
    console.error('Stores Data API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
