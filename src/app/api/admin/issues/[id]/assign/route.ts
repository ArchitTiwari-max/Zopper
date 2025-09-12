import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
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

    const { executiveId, adminComment } = await req.json();

    if (!executiveId) {
      return NextResponse.json(
        { error: 'Executive ID is required' },
        { status: 400 }
      );
    }

    // Await params in Next.js 15
    const { id: issueId } = await params;
    
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

    // Verify the executive exists
    const executive = await prisma.executive.findUnique({
      where: {
        id: executiveId
      }
    });

    if (!executive) {
      return NextResponse.json(
        { error: 'Executive not found' },
        { status: 404 }
      );
    }

    // Create the assignment
    const assignment = await prisma.assigned.create({
      data: {
        issueId: issue.id,
        executiveId: executiveId,
        adminComment: adminComment || '',
        status: 'Assigned'
      },
      include: {
        executive: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Update issue status to Assigned if it's currently Pending
    if (issue.status === 'Pending') {
      await prisma.issue.update({
        where: { id: issue.id },
        data: { status: 'Assigned' }
      });
    }

    // Return the formatted assignment
    const formattedAssignment = {
      id: assignment.id,
      executiveId: assignment.executive.id,
      executiveName: assignment.executive.name,
      executiveInitials: assignment.executive.name.split(' ').map(n => n[0]).join(''),
      dateAssigned: assignment.createdAt.toISOString().split('T')[0],
      adminComment: assignment.adminComment,
      status: assignment.status,
      assignedBy: 'Admin'
    };

    return NextResponse.json({
      success: true,
      assignment: formattedAssignment
    });

  } catch (error) {
    console.error('Error assigning task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
