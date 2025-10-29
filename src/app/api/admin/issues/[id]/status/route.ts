import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(req);
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const { status, resolution } = await req.json();

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['Pending', 'Assigned', 'Resolved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Await params in Next.js 15
    const { id } = await params;
    const issueId = id;
    
    // Find the issue by real MongoDB ObjectId
    const issue = await prisma.issue.findUnique({
      where: {
        id: issueId
      }
    });

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      status: status
    };

    // Update the issue
    const updatedIssue = await prisma.issue.update({
      where: { id: issue.id },
      data: updateData,
      include: {
        visit: {
          include: {
            executive: {
              select: {
                id: true,
                name: true,
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
                id: true,
                name: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    // Format the response similar to the GET endpoint
    const formattedIssue = {
      id: updatedIssue.id,
      issueId: `#Issue_${updatedIssue.id}`,
      storeName: updatedIssue.visit.store.storeName,
      storeId: updatedIssue.visit.store.id,
      location: updatedIssue.visit.store.fullAddress || updatedIssue.visit.store.city,
      city: updatedIssue.visit.store.city,
      dateReported: updatedIssue.createdAt.toISOString().split('T')[0],
      reportedBy: updatedIssue.visit.executive.name,
      reportedByRole: 'Executive',
      status: updatedIssue.status,
      description: updatedIssue.details,
      assignmentHistory: updatedIssue.assigned.map(assignment => ({
        id: assignment.id,
        executiveId: assignment.executive.id,
        executiveName: assignment.executive.name,
        executiveInitials: assignment.executive.name.split(' ').map(n => n[0]).join(''),
        dateAssigned: assignment.createdAt.toISOString().split('T')[0],
        adminComment: assignment.adminComment,
        status: assignment.status
      })),
      createdAt: updatedIssue.createdAt.toISOString(),
      updatedAt: updatedIssue.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      issue: formattedIssue
    });

  } catch (error) {
    console.error('Error updating issue status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
