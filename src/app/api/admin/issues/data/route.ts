import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check if admin
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (!user.roles.includes('ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' }, 
        { status: 403 }
      );
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';
    const storeName = searchParams.get('storeName');
    const storeId = searchParams.get('storeId');
    const executiveId = searchParams.get('executiveId');
    const executiveName = searchParams.get('executiveName');
    const status = searchParams.get('status');
    const issueId = searchParams.get('issueId');

    // Generate ETag for cache validation (2-minute intervals)
    const currentTime = Math.floor(Date.now() / (2 * 60 * 1000)) * (2 * 60 * 1000);
    const cacheKey = JSON.stringify({ 
      dateFilter, storeName, storeId, executiveId, executiveName, status, issueId 
    });
    const crypto = await import('crypto');
    const paramsHash = crypto.createHash('md5').update(cacheKey).digest('hex');
    const etag = `"${currentTime}-admin-issues-${paramsHash}"`;
    
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

    console.log('Issues Data API - Filter parameters:', {
      dateFilter, storeName, storeId, executiveId, executiveName, status, issueId
    });

    // Calculate date range based on filter
    const now = new Date();
    let startDate: Date | undefined;

    switch (dateFilter) {
      case 'All Time':
        break;
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

    // Build where clause for issues (support both Visit and DigitalVisit relations)
    let whereClause: any = {};
    if (startDate) {
      whereClause.createdAt = {
        gte: startDate,
        lte: now
      };
    }

    const andConds: any[] = [];
    if (storeId) {
      andConds.push({ OR: [ { visit: { storeId } }, { digitalVisit: { storeId } }, { stakeholderVisit: { brandId: storeId } } ] }); // Note: using brandId for stakeholder mapping in filters if needed
    }
    if (executiveId) {
      andConds.push({ OR: [ { visit: { executiveId } }, { digitalVisit: { executiveId } }, { stakeholderVisit: { executiveId } } ] });
    }
    if (andConds.length) {
      whereClause.AND = andConds;
    }

    // Handle status filtering with specific logic:
    // - "Pending" shows both Pending and Assigned issues
    // - "Assigned" shows only Assigned issues  
    // - "Resolved" shows only Resolved issues
    if (status && status !== 'All Status') {
      if (status === 'Pending') {
        // "Pending" filter includes both Pending and Assigned issues
        whereClause.status = {
          in: ['Pending', 'Assigned']
        };
      } else {
        // Other statuses (Assigned, Resolved) filter exactly
        whereClause.status = status;
      }
    }

    console.log('Issues Data API - Final where clause:', JSON.stringify(whereClause, null, 2));

    // OPTIMIZED: Get issues and brands concurrently with Promise.all - no limits, fetch all data
    const [issues, brands] = await Promise.all([
      // Get ALL issues with related data - no limits
      prisma.issue.findMany({
        where: whereClause,
        include: {
          visit: {
            include: {
              employee: { select: { id: true, name: true } },
              store: { select: { id: true, storeName: true, city: true, fullAddress: true, storeBrands: { select: { brandId: true } } } }
            }
          },
          digitalVisit: {
            include: {
              employee: { select: { id: true, name: true } },
              store: { select: { id: true, storeName: true, city: true, fullAddress: true, storeBrands: { select: { brandId: true } } } }
            }
          },
          stakeholderVisit: {
            include: {
              employee: { select: { id: true, name: true } },
              brand: { select: { brandName: true } }
            }
          },
          assigned: {
            include: {
              employee: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Get ALL brands for brand mapping - no limits
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true
        }
      })
    ]);

    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Process issues data (works for both physical and digital visits)
    let processedIssues = issues.map((issue) => {
      const source = issue.visit ?? issue.digitalVisit ?? issue.stakeholderVisit; // prefer physical if present

      // Build brand list
      let partnerBrandNames: string[] = [];
      if (issue.stakeholderVisit && (issue.stakeholderVisit as any).brand) {
        partnerBrandNames = [(issue.stakeholderVisit as any).brand.brandName];
      } else if (issue.visit && Array.isArray((issue.visit as any).brandIds)) {
        const visitBrands = (issue.visit as any).brandIds
          .map((brandId: string) => brandMap.get(brandId))
          .filter(Boolean) as string[];
        partnerBrandNames = visitBrands;
      } else if (source?.store && Array.isArray((source.store as any).storeBrands)) {
        const pb = (source.store as any).storeBrands
          .map((sb: any) => brandMap.get(sb.brandId))
          .filter(Boolean) as string[];
        partnerBrandNames = pb;
      }

      const brandAssociated = partnerBrandNames[0] || 'Unknown Brand';

      // Format date to dd/mm/yyyy format
      const issueDate = new Date(issue.createdAt);
      const formattedDateReported = `${issueDate.getDate().toString().padStart(2, '0')}/${(issueDate.getMonth() + 1).toString().padStart(2, '0')}/${issueDate.getFullYear()}`;

      // Store name fallback for stakeholder visits
      const storeName = source?.store?.storeName || (issue.stakeholderVisit ? `${(issue.stakeholderVisit as any).brand?.brandName || 'Brand'} - ${(issue.stakeholderVisit as any).stakeholderDesignation}` : 'Unknown Store');
      const location = source?.store?.fullAddress || source?.store?.city || (issue.stakeholderVisit as any)?.state || 'N/A';
      const city = source?.store?.city || (issue.stakeholderVisit as any)?.state || 'N/A';

      return {
        id: issue.id, // Use real MongoDB ObjectId
        issueId: issue.id, // Display ID
        storeName: storeName,
        storeId: source?.store?.id || (issue.stakeholderVisit ? 'stakeholder' : ''),
        location: location,
        brandAssociated: brandAssociated,
        city: city,
        dateReported: formattedDateReported,
        reportedBy: source?.employee?.name || 'Unknown Executive',
        reportedByRole: 'Executive',
        status: issue.status,
        description: issue.details,
        assignmentHistory: [],
        comments: [],
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString()
      };
    });

    // Apply additional filters only if no ID filtering was done
    if (storeName && storeName !== 'All Stores' && !storeId) {
      processedIssues = processedIssues.filter(issue => 
        issue.storeName.toLowerCase().includes(storeName.toLowerCase())
      );
    }

    if (executiveName && executiveName !== 'All Executives' && !executiveId) {
      processedIssues = processedIssues.filter(issue => 
        issue.reportedBy.toLowerCase().includes(executiveName.toLowerCase())
      );
    }

    // Filter by specific issue ID if provided
    if (issueId) {
      processedIssues = processedIssues.filter(issue => issue.id === issueId);
    }

    console.log('Issues Data API - Final processed issues:', processedIssues.length);

    const response = NextResponse.json({
      issues: processedIssues,
      total: processedIssues.length
    });
    
    // Add secure caching headers
    response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');
    response.headers.set('Vary', 'Authorization');
    response.headers.set('ETag', etag);
    
    return response;

  } catch (error) {
    console.error('Issues Data API Error:', error);
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
