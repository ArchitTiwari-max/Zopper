import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const visitId = params.id;

    // Parse request body for admin comment and follow-up flag
    const body = await request.json().catch(() => ({}));
    const adminComment = body.adminComment || null;
    const requiresFollowUp = body.requiresFollowUp || false;

    // Find admin profile for reviewer tracking
    const adminProfile = await prisma.admin.findUnique({
      where: { userId: user.userId },
      select: { id: true, name: true }
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: 'Admin profile not found' },
        { status: 404 }
      );
    }

    // Find the visit first to verify it exists
    const existingVisit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        status: true,
        remarks: true,
        executiveId: true,
        store: {
          select: {
            storeName: true
          }
        },
        executive: {
          select: {
            name: true
          }
        }
      }
    });

    if (!existingVisit) {
      return NextResponse.json(
        { error: 'Visit not found' },
        { status: 404 }
      );
    }

    if (existingVisit.status === 'REVIEWD') {
      return NextResponse.json(
        { error: 'Visit is already reviewed' },
        { status: 400 }
      );
    }

    // Update visit status to REVIEWD and record reviewer
    const updatedVisit = await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'REVIEWD',
        adminComment: adminComment,
        reviewedAt: new Date(),
        reviewedByAdminId: adminProfile.id,
        updatedAt: new Date()
      },
      select: {
        id: true,
        status: true,
        adminComment: true,
        reviewedAt: true,
        reviewedByAdmin: { select: { id: true, name: true } },
        updatedAt: true
      }
    });

    let createdIssue = null;
    let createdAssignment = null;
    let responseMessage = `Visit for ${existingVisit.store.storeName} by ${existingVisit.executive.name} has been marked as reviewed by ${adminProfile.name}`;

    // If follow-up is required, create an issue from visit remarks
    if (requiresFollowUp && existingVisit.remarks && existingVisit.remarks.trim() !== '') {
      try {
        // Generate unique issue ID
        const issueId = new Date().getTime().toString().slice(-7);
        
        // Create issue from visit remarks
        createdIssue = await prisma.issue.create({
          data: {
            id: issueId,
            details: existingVisit.remarks,
            createdBy: 'ADMIN', // Admin created this issue during review
            status: 'Assigned', // Directly assign to executive
            visitId: visitId
          }
        });

        // Create assignment to the same executive who created the visit
        createdAssignment = await prisma.assigned.create({
          data: {
            adminComment: adminComment || 'Follow-up required for visit remarks',
            status: 'Assigned',
            issueId: createdIssue.id,
            executiveId: existingVisit.executiveId
          }
        });

        responseMessage += ` and an issue (#${createdIssue.id}) has been created and assigned to the executive for follow-up`;
        console.log(`Created issue ${createdIssue.id} and assigned to executive ${existingVisit.executiveId}`);
      } catch (issueError) {
        console.error('Error creating issue during follow-up:', issueError);
        // Don't fail the entire request if issue creation fails
        responseMessage += ` (Note: Follow-up issue creation failed)`;
      }
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      visit: updatedVisit,
      issue: createdIssue,
      assignment: createdAssignment
    });

  } catch (error) {
    console.error('Mark Visit Reviewed API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
