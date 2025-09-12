import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Await params in Next.js 15
    const { id } = await params;

    // Find the issue by real MongoDB ObjectId
    const targetIssue = await prisma.issue.findUnique({
      where: {
        id: id
      },
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
            },
            assignReport: {
              select: {
                remarks: true,
                personMetName: true,
                personMetDesignation: true,
                photoUrls: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!targetIssue) {
      return NextResponse.json(
        { error: 'Issue not found' }, 
        { status: 404 }
      );
    }

    // Get all brands for brand mapping
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        brandName: true
      }
    });
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Get brand associated with the visit
    const visitBrands = targetIssue.visit.brandIds
      .map(brandId => brandMap.get(brandId))
      .filter(Boolean) as string[];
    
    const brandAssociated = visitBrands[0] || 'Unknown Brand';


    // Process assignment history
    const assignmentHistory = targetIssue.assigned.map(assignment => {
      // Generate initials from executive name
      const executiveInitials = assignment.executive.name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('');

      return {
        id: assignment.id,
        executiveName: assignment.executive.name,
        executiveInitials: executiveInitials,
        dateAssigned: assignment.createdAt.toISOString().split('T')[0],
        status: assignment.status,
        adminComment: assignment.adminComment || '',
        report: assignment.assignReport ? {
          remarks: assignment.assignReport.remarks,
          personMet: assignment.assignReport.personMetName,
          designation: assignment.assignReport.personMetDesignation,
          photos: assignment.assignReport.photoUrls,
          submittedAt: assignment.assignReport.createdAt.toISOString()
        } : null
      };
    });

    // Build the detailed issue response
    const issueDetail = {
      id: targetIssue.id,
      issueId: `#Issue_${targetIssue.id}`,
      storeName: targetIssue.visit.store.storeName,
      storeId: targetIssue.visit.store.id,
      location: targetIssue.visit.store.fullAddress || targetIssue.visit.store.city,
      brandAssociated: brandAssociated,
      city: targetIssue.visit.store.city,
      dateReported: new Date(targetIssue.createdAt).toISOString().split('T')[0],
      reportedBy: targetIssue.visit.executive.name,
      reportedByRole: 'Executive',
      status: targetIssue.status,
      description: targetIssue.details,
      assignmentHistory: assignmentHistory,
      createdAt: targetIssue.createdAt.toISOString(),
      updatedAt: targetIssue.updatedAt.toISOString(),
      // Additional details for the detail page
      executive: {
        id: targetIssue.visit.executive.id,
        name: targetIssue.visit.executive.name
      },
      store: {
        id: targetIssue.visit.store.id,
        name: targetIssue.visit.store.storeName,
        address: targetIssue.visit.store.fullAddress,
        city: targetIssue.visit.store.city
      },
      visit: {
        id: targetIssue.visit.id,
        createdAt: targetIssue.visit.createdAt.toISOString(),
        remarks: targetIssue.visit.remarks
      }
    };

    return NextResponse.json(issueDetail);

  } catch (error) {
    console.error('Issue Detail API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

