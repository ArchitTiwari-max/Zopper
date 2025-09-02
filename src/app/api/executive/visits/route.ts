import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET endpoint to fetch all visits of the authenticated executive (for visit history page)
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

    // Add pagination support
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50'); // Default 50 visits
    const skip = (page - 1) * limit;

    // Get visits for this executive with optimized query (select only needed fields)
    const visits = await prisma.visit.findMany({
      where: {
        executiveId: executive.id
      },
      select: {
        id: true,
        status: true,
        personMet: true,
        displayChecked: true,
        remarks: true,
        imageUrls: true,
        adminComment: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: {
            id: true,
            storeName: true
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

    // Transform visits data
    const transformedVisits = visits.map(visit => ({
      id: visit.id,
      storeName: visit.store?.storeName || 'Unknown Store',
      status: visit.status,
      representative: visit.executive?.name || 'Unknown Executive',
      personMet: visit.personMet,
      displayChecked: visit.displayChecked,
      remarks: visit.remarks,
      imageUrls: visit.imageUrls,
      adminComment: visit.adminComment,
      date: visit.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }), // Add date field for VisitDetailsModal compatibility
      issues: visit.issues.map(issue => ({
        id: issue.id,
        details: issue.details,
        status: issue.status,
        createdAt: issue.createdAt,
        assigned: issue.assigned
          .filter(assignment => assignment.executive) // Filter out null executives
          .map(assignment => ({
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

    return NextResponse.json({
      success: true,
      data: transformedVisits
    });

  } catch (error) {
    console.error('Error fetching executive visits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executive visits' },
      { status: 500 }
    );
  }
}

// POST endpoint to create a new visit with optional issue
export async function POST(request: NextRequest) {
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

    const {
      storeId,
      personMet,
      displayChecked,
      issuesReported,
      brandsVisited,
      remarks,
      imageUrls
    } = await request.json();

    // Validate required fields
    if (!storeId || !personMet || personMet.length === 0) {
      return NextResponse.json({ 
        error: 'Store ID and at least one person met are required' 
      }, { status: 400 });
    }

    // Get brand IDs from brand names
    const brandIds: string[] = [];
    if (brandsVisited && brandsVisited.length > 0) {
      const brands = await prisma.brand.findMany({
        where: {
          brandName: {
            in: brandsVisited
          }
        }
      });
      brandIds.push(...brands.map(brand => brand.id));
    }

    // Create the visit
    const visit = await prisma.visit.create({
      data: {
        personMet: personMet, // JSON array
        displayChecked: displayChecked || false,
        remarks: remarks || '',
        imageUrls: imageUrls || [],
        status: 'PENDING_REVIEW' as any, // Default status - using enum value
        executiveId: executive.id,
        storeId: storeId,
        brandIds: brandIds
      },
      include: {
        store: true,
        executive: {
          include: {
            user: true
          }
        }
      }
    });

    // Create issue if issuesReported is not null/empty
    let createdIssue = null;
    if (issuesReported && issuesReported.trim() !== '') {
      createdIssue = await prisma.issue.create({
        data: {
          details: issuesReported.trim(),
          visitId: visit.id,
          status: 'Pending' // Default status
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        visit: {
          id: visit.id,
          status: visit.status,
          createdAt: visit.createdAt
        },
        issue: createdIssue ? {
          id: createdIssue.id,
          details: createdIssue.details,
          status: createdIssue.status
        } : null
      }
    });

  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json(
      { error: 'Failed to create visit' },
      { status: 500 }
    );
  }
}
