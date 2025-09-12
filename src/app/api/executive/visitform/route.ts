import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { generateUniqueIssueId } from '@/lib/issueIdGenerator';

const prisma = new PrismaClient();

// GET endpoint to fetch past visits for a store (all executives)
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

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
 
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Get last 5 visits for this store by ANY executive
    const visits = await prisma.visit.findMany({
      where: {
        storeId: storeId
      },
      include: {
        issues: {
          include: {
            assigned: {
              include: {
                executive: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        },
        store: true,
        executive: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    // Transform visits data, handling null executives
    const transformedVisits = visits
      .filter(visit => visit.executive) // Only include visits with valid executives
      .map(visit => ({
        id: visit.id,
        date: visit.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        status: visit.status, // PENDING or COMPLETED
        representative: visit.executive?.name || 'Unknown Executive',
        personMet: visit.personMet,
        displayChecked: visit.displayChecked,
        remarks: visit.remarks,
        imageUrls: visit.imageUrls,
        adminComment: visit.adminComment,
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
    console.error('Error fetching visits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visits' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
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
      issuesRaised,
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
        status: 'PENDING_REVIEW' as any, // Default status
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

    // Create issues if any are raised
    let createdIssues: any[] = [];
    if (issuesRaised && Array.isArray(issuesRaised) && issuesRaised.length > 0) {
      // Create multiple issues
      for (const issueDetail of issuesRaised) {
        if (issueDetail && issueDetail.trim() !== '') {
          // Generate unique 7-character issue ID
          const uniqueIssueId = await generateUniqueIssueId();
          
          const createdIssue = await prisma.issue.create({
            data: {
              id: uniqueIssueId,
              details: issueDetail.trim(),
              visitId: visit.id,
              status: 'Pending' // Default status
            }
          });
          createdIssues.push({
            id: createdIssue.id,
            details: createdIssue.details,
            status: createdIssue.status
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        visit: {
          id: visit.id,
          status: visit.status,
          createdAt: visit.createdAt
        },
        issues: createdIssues
      }
    });

  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json(
      { error: 'Failed to create visit' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
