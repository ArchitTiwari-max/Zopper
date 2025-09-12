import { prisma } from '@/lib/prisma';
import { NotificationType, NotificationPriority, NotificationStatus, Role } from '@prisma/client';

// TypeScript interfaces for better type safety
export interface CreateNotificationData {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  recipientId: string;
  recipientRole: Role;
  senderId?: string;
  senderRole?: Role;
  visitId?: string;
  issueId?: string;
  assignedId?: string;
  visitPlanId?: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface NotificationFilters {
  status?: NotificationStatus;
  type?: NotificationType;
  priority?: NotificationPriority;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  
  /**
   * Create a new notification
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          title: data.title,
          message: data.message,
          type: data.type,
          priority: data.priority || 'MEDIUM',
          recipientId: data.recipientId,
          recipientRole: data.recipientRole,
          senderId: data.senderId,
          senderRole: data.senderRole,
          visitId: data.visitId,
          issueId: data.issueId,
          assignedId: data.assignedId,
          visitPlanId: data.visitPlanId,
          metadata: data.metadata,
          actionUrl: data.actionUrl,
          expiresAt: data.expiresAt
        }
      });

      console.log(`✅ Notification created: ${data.type} for ${data.recipientRole}`);
      return notification;
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(
    userId: string, 
    userRole: Role, 
    filters: NotificationFilters = {}
  ) {
    const where: any = {
      recipientId: userId,
      recipientRole: userRole
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    // Exclude expired notifications (skip this filter for now since it was causing issues)
    // We'll implement proper expiration filtering later if needed
    // const currentDate = new Date();
    // where.OR = [
    //   { expiresAt: null },
    //   { expiresAt: { gt: currentDate } }
    // ];

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: filters.limit || 50,
      skip: filters.offset || 0,
      include: {
        visit: {
          include: {
            store: true,
            executive: true
          }
        },
        issue: {
          include: {
            visit: {
              include: {
                store: true
              }
            }
          }
        },
        assigned: {
          include: {
            issue: {
              include: {
                visit: {
                  include: {
                    store: true
                  }
                }
              }
            },
            executive: true
          }
        },
        visitPlan: {
          include: {
            executive: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    return notifications;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { 
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    });
  }

  /**
   * Mark multiple notifications as read
   */
  static async markMultipleAsRead(notificationIds: string[]) {
    await prisma.notification.updateMany({
      where: { 
        id: { in: notificationIds }
      },
      data: { 
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    });
  }

  /**
   * Archive notification
   */
  static async archiveNotification(notificationId: string) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { 
        status: NotificationStatus.ARCHIVED,
        archivedAt: new Date()
      }
    });
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string, userRole: Role) {
    // Skip expiration filter for now since it was causing issues
    // We'll implement proper expiration filtering later if needed
    const where = {
      recipientId: userId,
      recipientRole: userRole,
      status: NotificationStatus.UNREAD
    };
    
    const count = await prisma.notification.count({
      where
    });

    return count;
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications() {
    const deleted = await prisma.notification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    console.log(`🧹 Cleaned up ${deleted.count} expired notifications`);
    return deleted.count;
  }
}

// Event-specific notification creators
export class NotificationEvents {

  /**
   * Executive submits a visit -> Notify Admin
   */
  static async onVisitSubmitted(visitId: string, executiveUserId: string, adminUserIds: string[]) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        store: true,
        executive: true
      }
    });

    if (!visit) return;

    const notifications = adminUserIds.map(adminId => 
      NotificationService.createNotification({
        title: '🏪 New Visit Submitted',
        message: `${visit.executive.name} has submitted a visit report for ${visit.store.storeName}`,
        type: 'VISIT_SUBMITTED',
        priority: 'MEDIUM',
        recipientId: adminId,
        recipientRole: 'ADMIN',
        senderId: executiveUserId,
        senderRole: 'EXECUTIVE',
        visitId: visitId,
        actionUrl: `/admin/stores/${visit.storeId}/visits/${visitId}`,
        metadata: {
          storeName: visit.store.storeName,
          executiveName: visit.executive.name
        }
      })
    );

    await Promise.all(notifications);
  }

  /**
   * Admin reviews a visit -> Notify Executive
   */
  static async onVisitReviewed(visitId: string, adminUserId: string, status: 'REVIEWED' | 'NEEDS_UPDATE') {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        store: true,
        executive: { include: { user: true } }
      }
    });

    if (!visit) return;

    await NotificationService.createNotification({
      title: status === 'REVIEWED' ? '✅ Visit Approved' : '📝 Visit Needs Update',
      message: `Your visit report for ${visit.store.storeName} has been ${status.toLowerCase()}`,
      type: 'VISIT_REVIEWED',
      priority: status === 'NEEDS_UPDATE' ? 'HIGH' : 'MEDIUM',
      recipientId: visit.executive.userId,
      recipientRole: 'EXECUTIVE',
      senderId: adminUserId,
      senderRole: 'ADMIN',
      visitId: visitId,
      actionUrl: `/executive/visit-history/${visitId}`,
      metadata: {
        storeName: visit.store.storeName,
        status: status
      }
    });
  }

  /**
   * Executive reports an issue -> Notify Admin
   */
  static async onIssueReported(issueId: string, executiveUserId: string, adminUserIds: string[]) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        visit: {
          include: {
            store: true,
            executive: true
          }
        }
      }
    });

    if (!issue) return;

    const notifications = adminUserIds.map(adminId => 
      NotificationService.createNotification({
        title: '⚠️ New Issue Reported',
        message: `${issue.visit.executive.name} reported an issue at ${issue.visit.store.storeName}`,
        type: 'ISSUE_REPORTED',
        priority: 'HIGH',
        recipientId: adminId,
        recipientRole: 'ADMIN',
        senderId: executiveUserId,
        senderRole: 'EXECUTIVE',
        issueId: issueId,
        visitId: issue.visitId,
        actionUrl: `/admin/issues/${issueId}`,
        metadata: {
          storeName: issue.visit.store.storeName,
          executiveName: issue.visit.executive.name,
          issueDetails: issue.details.substring(0, 100)
        }
      })
    );

    await Promise.all(notifications);
  }

  /**
   * Admin assigns issue -> Notify Executive
   */
  static async onIssueAssigned(assignedId: string, adminUserId: string) {
    const assigned = await prisma.assigned.findUnique({
      where: { id: assignedId },
      include: {
        issue: {
          include: {
            visit: {
              include: {
                store: true
              }
            }
          }
        },
        executive: {
          include: { user: true }
        }
      }
    });

    if (!assigned) return;

    await NotificationService.createNotification({
      title: '📋 Issue Assigned to You',
      message: `You've been assigned an issue at ${assigned.issue.visit.store.storeName}`,
      type: 'ISSUE_ASSIGNED',
      priority: 'HIGH',
      recipientId: assigned.executive.userId,
      recipientRole: 'EXECUTIVE',
      senderId: adminUserId,
      senderRole: 'ADMIN',
      assignedId: assignedId,
      issueId: assigned.issueId,
      actionUrl: `/executive/assignments/${assignedId}`,
      metadata: {
        storeName: assigned.issue.visit.store.storeName,
        issueDetails: assigned.issue.details.substring(0, 100)
      }
    });
  }

  /**
   * Executive updates issue status -> Notify Admin
   */
  static async onIssueStatusUpdated(assignedId: string, executiveUserId: string, newStatus: string, adminUserIds: string[]) {
    const assigned = await prisma.assigned.findUnique({
      where: { id: assignedId },
      include: {
        issue: {
          include: {
            visit: {
              include: {
                store: true,
                executive: true
              }
            }
          }
        }
      }
    });

    if (!assigned) return;

    const statusLabels = {
      'Assigned': 'acknowledged',
      'In_Progress': 'started working on',
      'Completed': 'completed'
    };

    const notifications = adminUserIds.map(adminId => 
      NotificationService.createNotification({
        title: '🔄 Issue Status Updated',
        message: `${assigned.issue.visit.executive.name} has ${statusLabels[newStatus as keyof typeof statusLabels]} the issue at ${assigned.issue.visit.store.storeName}`,
        type: 'ISSUE_STATUS_UPDATED',
        priority: newStatus === 'Completed' ? 'HIGH' : 'MEDIUM',
        recipientId: adminId,
        recipientRole: 'ADMIN',
        senderId: executiveUserId,
        senderRole: 'EXECUTIVE',
        assignedId: assignedId,
        issueId: assigned.issueId,
        actionUrl: `/admin/assignments/${assignedId}`,
        metadata: {
          storeName: assigned.issue.visit.store.storeName,
          executiveName: assigned.issue.visit.executive.name,
          newStatus: newStatus
        }
      })
    );

    await Promise.all(notifications);
  }

  /**
   * Admin adds comment -> Notify Executive
   */
  static async onAdminCommentAdded(visitId: string, adminUserId: string, comment: string) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        store: true,
        executive: { include: { user: true } }
      }
    });

    if (!visit) return;

    await NotificationService.createNotification({
      title: '💬 Admin Comment Added',
      message: `Admin has added a comment to your visit report for ${visit.store.storeName}`,
      type: 'ADMIN_COMMENT_ADDED',
      priority: 'MEDIUM',
      recipientId: visit.executive.userId,
      recipientRole: 'EXECUTIVE',
      senderId: adminUserId,
      senderRole: 'ADMIN',
      visitId: visitId,
      actionUrl: `/executive/visit-history/${visitId}`,
      metadata: {
        storeName: visit.store.storeName,
        comment: comment.substring(0, 100)
      }
    });
  }

  /**
   * System announcement -> Notify All Users
   */
  static async createSystemAnnouncement(
    title: string, 
    message: string, 
    priority: NotificationPriority = 'MEDIUM',
    targetRole?: Role,
    expiresAt?: Date
  ) {
    // Get all users or users of specific role
    const whereClause = targetRole ? { role: targetRole } : {};
    const users = await prisma.user.findMany({
      where: whereClause,
      select: { id: true, role: true }
    });

    const notifications = users.map(user => 
      NotificationService.createNotification({
        title: `📢 ${title}`,
        message,
        type: 'SYSTEM_ANNOUNCEMENT',
        priority,
        recipientId: user.id,
        recipientRole: user.role,
        expiresAt,
        metadata: {
          isSystemAnnouncement: true,
          targetRole: targetRole || 'ALL'
        }
      })
    );

    await Promise.all(notifications);
  }
}
