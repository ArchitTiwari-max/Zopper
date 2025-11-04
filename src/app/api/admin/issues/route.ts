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
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';
    const storeName = searchParams.get('storeName');
    const status = searchParams.get('status');
    const issueId = searchParams.get('issueId');

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

    if (status && status !== 'All Status') {
      whereClause.status = status;
    }

    // Get issues with related data
    const issues = await prisma.issue.findMany({
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
    });

    // Get all brands for brand mapping
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        brandName: true
      }
    });
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Process issues data
    let processedIssues = issues.map((issue) => {
      // Get brand associated with the visit
      const visitBrands = issue.visit.brandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean) as string[];
      
      const brandAssociated = visitBrands[0] || 'Unknown Brand';

      return {
        id: issue.id, // Use real MongoDB ObjectId
        issueId: issue.id, // Use clean 7-character ID
        storeName: issue.visit.store.storeName,
        storeId: issue.visit.store.id,
        location: issue.visit.store.fullAddress || issue.visit.store.city,
        brandAssociated: brandAssociated,
        city: issue.visit.store.city,
        dateReported: new Date(issue.createdAt).toISOString().split('T')[0],
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

    // Apply additional filters
    if (storeName && storeName !== 'All Stores') {
      processedIssues = processedIssues.filter(issue => 
        issue.storeName.toLowerCase().includes(storeName.toLowerCase())
      );
    }


    // Filter by specific issue ID if provided
    if (issueId) {
      processedIssues = processedIssues.filter(issue => issue.id === issueId);
    }

    return NextResponse.json({
      issues: processedIssues,
      total: processedIssues.length
    });

  } catch (error) {
    console.error('Issues API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

