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
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';
    const storeName = searchParams.get('storeName');
    const storeId = searchParams.get('storeId');
    const executiveId = searchParams.get('executiveId');
    const executiveName = searchParams.get('executiveName');
    const status = searchParams.get('status');
    const issueId = searchParams.get('issueId');

    console.log('Issues Data API - Filter parameters:', {
      dateFilter, storeName, storeId, executiveId, executiveName, status, issueId
    });

    // Calculate date range based on filter
    const now = new Date();
    let startDate: Date;

    switch (dateFilter) {
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

    // Build where clause for issues
    let whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: now
      }
    };

    // Add direct ID filters to the database query for better performance
    if (storeId) {
      whereClause.visit = {
        storeId: storeId
      };
    }

    if (executiveId) {
      whereClause.visit = {
        ...whereClause.visit,
        executiveId: executiveId
      };
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
              executive: {
                select: {
                  id: true,
                  name: true
                }
              },
              store: {
                select: {
                  id: true,
                  storeName: true,
                  city: true,
                  fullAddress: true
                }
              }
            }
          },
          assigned: {
            include: {
              executive: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
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

    // Process issues data
    let processedIssues = issues.map((issue) => {
      // Get brand associated with the visit
      const visitBrands = issue.visit.brandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean) as string[];
      
      const brandAssociated = visitBrands[0] || 'Unknown Brand';

      // Format date to dd/mm/yyyy format
      const issueDate = new Date(issue.createdAt);
      const formattedDateReported = `${issueDate.getDate().toString().padStart(2, '0')}/${(issueDate.getMonth() + 1).toString().padStart(2, '0')}/${issueDate.getFullYear()}`;

      return {
        id: issue.id, // Use real MongoDB ObjectId
        issueId: issue.id, // Use clean 7-character ID
        storeName: issue.visit.store.storeName,
        storeId: issue.visit.store.id,
        location: issue.visit.store.fullAddress || issue.visit.store.city,
        brandAssociated: brandAssociated,
        city: issue.visit.store.city,
        dateReported: formattedDateReported,
        reportedBy: issue.visit.executive.name,
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

    return NextResponse.json({
      issues: processedIssues,
      total: processedIssues.length
    });

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
