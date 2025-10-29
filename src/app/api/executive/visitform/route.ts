import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { generateUniqueIssueId } from '@/lib/issueIdGenerator';

export const runtime = 'nodejs';

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

    // Get current executive info first
    const currentExecutive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!currentExecutive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
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
      .map(visit => {
        const isCurrentExecutive = visit.executiveId === currentExecutive.id;
        
        if (isCurrentExecutive) {
          // Full data for current executive's visits
          return {
            id: visit.id,
            date: visit.createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            status: visit.status,
            representative: visit.executive?.name || 'Unknown Executive',
            canViewDetails: true,
            personMet: visit.personMet,
            POSMchecked: visit.POSMchecked,
            remarks: visit.remarks,
            imageUrls: visit.imageUrls,
            adminComment: visit.adminComment,
            storeName: visit.store?.storeName || 'Unknown Store',
            issues: visit.issues
              .filter(issue => 
                issue.assigned.some(assignment => 
                  assignment.executive && assignment.executive.id === currentExecutive.id
                )
              )
              .map(issue => ({
                id: issue.id,
                details: issue.details,
                status: issue.status,
                createdAt: issue.createdAt,
                assigned: issue.assigned
                  .filter(assignment => 
                    assignment.executive && assignment.executive.id === currentExecutive.id
                  )
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
          };
        } else {
          // Limited data for other executives' visits - but include contact person and issues for coordination
          return {
            id: visit.id,
            date: visit.createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            status: visit.status,
            representative: visit.executive?.name || 'Unknown Executive',
            canViewDetails: false,
            personMet: visit.personMet, // Show contact person info for coordination
            POSMchecked: null, // No sensitive POSM info
            remarks: null, // No private remarks
            imageUrls: [], // No private images
            adminComment: null, // No admin comments
            storeName: visit.store?.storeName || 'Unknown Store',
            issues: visit.issues.map(issue => ({
              id: issue.id,
              details: issue.details,
              status: issue.status,
              createdAt: issue.createdAt,
              assigned: [] // Don't show assignments for other executives
            })),
            createdAt: visit.createdAt,
            updatedAt: visit.updatedAt
          };
        }
      });

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
      visitDate,
      personMet,
      POSMchecked,
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

    if (!visitDate) {
      return NextResponse.json({ 
        error: 'Visit date is required' 
      }, { status: 400 });
    }

    // Validate visit date (IST timezone)
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset
    const istToday = new Date(today.getTime() + istOffset);
    const todayStr = istToday.toISOString().split('T')[0];
    const ninetyDaysAgo = new Date(istToday.getTime() - (90 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
    
    if (visitDate > todayStr) {
      return NextResponse.json({
        error: 'Visit date cannot be in the future',
        message: 'Please select today or a past date within the last 90 days',
        code: 'INVALID_VISIT_DATE_FUTURE'
      }, { status: 400 });
    }
    
    if (visitDate < ninetyDaysAgoStr) {
      return NextResponse.json({
        error: 'Visit date is too old',
        message: 'Please select a date within the last 90 days',
        code: 'INVALID_VISIT_DATE_TOO_OLD'
      }, { status: 400 });
    }

    // CRITICAL: Validate that executive is assigned to this store
    const assignment = await prisma.executiveStoreAssignment.findUnique({
      where: {
        executiveId_storeId: {
          executiveId: executive.id,
          storeId: storeId
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({
        error: 'Access denied: You are not assigned to this store',
        code: 'STORE_NOT_ASSIGNED'
      }, { status: 403 });
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

    // Convert visit date to proper DateTime for database
    const visitDateTime = new Date(visitDate + 'T00:00:00.000Z');

    // Create the visit
    const visit = await prisma.visit.create({
      data: {
        personMet: personMet, // JSON array
        POSMchecked: POSMchecked,
        remarks: remarks || '',
        imageUrls: imageUrls || [],
        status: 'PENDING_REVIEW' as any, // Default status
        executiveId: executive.id,
        storeId: storeId,
        brandIds: brandIds,
        createdAt: visitDateTime // The actual date when the visit occurred
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
              status: 'Pending', // Default status
              createdAt: visitDateTime // Same date as the visit occurred
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
