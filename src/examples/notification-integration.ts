import { NotificationEvents } from '@/lib/notification';
import { prisma } from '@/lib/prisma';
import { generateUniqueIssueId } from '@/lib/issueIdGenerator';

/**
 * Example: How to integrate notifications into your existing application
 * 
 * These examples show where to add notification triggers in your current workflows
 */

// EXAMPLE 1: When an executive submits a visit report
export async function handleVisitSubmission(visitData: any, executiveUserId: string) {
  try {
    // 1. Create the visit (your existing code)
    const visit = await prisma.visit.create({
      data: visitData
    });

    // 2. Get all admin user IDs
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    const adminIds = admins.map(admin => admin.id);

    // 3. Trigger notification
    await NotificationEvents.onVisitSubmitted(
      visit.id,
      executiveUserId,
      adminIds
    );

    return visit;
  } catch (error) {
    console.error('Error in visit submission:', error);
    throw error;
  }
}

// EXAMPLE 2: When admin reviews a visit
export async function handleVisitReview(visitId: string, adminUserId: string, approved: boolean, adminComment?: string) {
  try {
    // 1. Update visit status (your existing code)
    const updatedVisit = await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: approved ? 'REVIEWD' : 'PENDING_REVIEW',
        adminComment: adminComment
      }
    });

    // 2. Trigger notification
    const reviewStatus = approved ? 'REVIEWED' : 'NEEDS_UPDATE';
    await NotificationEvents.onVisitReviewed(visitId, adminUserId, reviewStatus);

    // 3. If admin added a comment, trigger separate notification
    if (adminComment) {
      await NotificationEvents.onAdminCommentAdded(visitId, adminUserId, adminComment);
    }

    return updatedVisit;
  } catch (error) {
    console.error('Error in visit review:', error);
    throw error;
  }
}

// EXAMPLE 3: When an executive reports an issue during visit submission
export async function handleIssueReporting(visitId: string, issueDetails: string, executiveUserId: string) {
  try {
    // 1. Create the issue (your existing code)
    const uniqueIssueId = await generateUniqueIssueId();
    const issue = await prisma.issue.create({
      data: {
        id: uniqueIssueId,
        details: issueDetails,
        visitId: visitId,
        status: 'Pending'
      }
    });

    // 2. Get all admin user IDs
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    const adminIds = admins.map(admin => admin.id);

    // 3. Trigger notification
    await NotificationEvents.onIssueReported(
      issue.id,
      executiveUserId,
      adminIds
    );

    return issue;
  } catch (error) {
    console.error('Error in issue reporting:', error);
    throw error;
  }
}

// EXAMPLE 4: When admin assigns an issue to an executive
export async function handleIssueAssignment(issueId: string, executiveId: string, adminUserId: string, adminComment?: string) {
  try {
    // 1. Create assignment (your existing code)
    const assignment = await prisma.assigned.create({
      data: {
        issueId: issueId,
        executiveId: executiveId,
        adminComment: adminComment,
        status: 'Assigned'
      }
    });

    // 2. Trigger notification
    await NotificationEvents.onIssueAssigned(assignment.id, adminUserId);

    return assignment;
  } catch (error) {
    console.error('Error in issue assignment:', error);
    throw error;
  }
}

// EXAMPLE 5: When executive updates assignment status
export async function handleAssignmentStatusUpdate(assignedId: string, newStatus: 'Assigned' | 'In_Progress' | 'Completed', executiveUserId: string) {
  try {
    // 1. Update assignment status (your existing code)
    const updatedAssignment = await prisma.assigned.update({
      where: { id: assignedId },
      data: { status: newStatus }
    });

    // 2. Get all admin user IDs
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    const adminIds = admins.map(admin => admin.id);

    // 3. Trigger notification
    await NotificationEvents.onIssueStatusUpdated(
      assignedId,
      executiveUserId,
      newStatus,
      adminIds
    );

    return updatedAssignment;
  } catch (error) {
    console.error('Error in assignment status update:', error);
    throw error;
  }
}

// EXAMPLE 6: System announcement (for admin use)
export async function createMaintenanceAnnouncement() {
  try {
    await NotificationEvents.createSystemAnnouncement(
      'System Maintenance',
      'The system will be under maintenance on Sunday, 2 PM - 4 PM IST. Please save your work.',
      'HIGH',
      undefined, // Send to all users
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
    );
  } catch (error) {
    console.error('Error creating announcement:', error);
    throw error;
  }
}

// EXAMPLE 7: Role-specific announcement
export async function createExecutiveAnnouncement() {
  try {
    await NotificationEvents.createSystemAnnouncement(
      'New Visit Guidelines',
      'Please review the updated visit guidelines in the documentation section.',
      'MEDIUM',
      'EXECUTIVE', // Only for executives
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expires in 30 days
    );
  } catch (error) {
    console.error('Error creating executive announcement:', error);
    throw error;
  }
}
