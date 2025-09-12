import { NotificationService, NotificationEvents } from '@/lib/notification';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * Test script to demonstrate the executive notification system
 * 
 * This script creates sample notifications to test the system
 */

async function createTestNotifications() {
  try {
    console.log('🚀 Creating test notifications for executives...');

    // Get a sample executive user
    const executiveUser = await prisma.user.findFirst({
      where: { role: 'EXECUTIVE' },
      include: { executive: true }
    });

    if (!executiveUser || !executiveUser.executive) {
      console.log('❌ No executive user found. Please create an executive user first.');
      return;
    }

    console.log(`✅ Found executive: ${executiveUser.executive.name} (${executiveUser.email})`);

    // Create test notifications for different scenarios

    // 1. Visit Reviewed notification (HIGH priority - needs update)
    await NotificationService.createNotification({
      title: '📝 Visit Needs Update',
      message: `Your visit report for ABC Electronics needs revision. Please check the admin comments and update accordingly.`,
      type: 'VISIT_REVIEWED',
      priority: 'HIGH',
      recipientId: executiveUser.id,
      recipientRole: Role.EXECUTIVE,
      actionUrl: '/executive/visit-history',
      metadata: {
        storeName: 'ABC Electronics',
        status: 'NEEDS_UPDATE'
      }
    });

    // 2. Visit Approved notification (MEDIUM priority)
    await NotificationService.createNotification({
      title: '✅ Visit Approved',
      message: 'Your visit report for XYZ Store has been reviewed and approved. Great work!',
      type: 'VISIT_REVIEWED',
      priority: 'MEDIUM',
      recipientId: executiveUser.id,
      recipientRole: Role.EXECUTIVE,
      actionUrl: '/executive/visit-history',
      metadata: {
        storeName: 'XYZ Store',
        status: 'REVIEWED'
      }
    });

    // 3. Issue Assignment notification (HIGH priority)
    await NotificationService.createNotification({
      title: '📋 New Issue Assigned',
      message: 'You have been assigned a new issue at Tech Mart. Please investigate and provide a resolution report.',
      type: 'ISSUE_ASSIGNED',
      priority: 'HIGH',
      recipientId: executiveUser.id,
      recipientRole: Role.EXECUTIVE,
      actionUrl: '/executive/assignments',
      metadata: {
        storeName: 'Tech Mart',
        issueDetails: 'Display not working properly'
      }
    });

    // 4. Admin Comment notification (MEDIUM priority)
    await NotificationService.createNotification({
      title: '💬 Admin Comment Added',
      message: 'Admin has added a comment to your visit report for Fashion Hub. Please review the feedback.',
      type: 'ADMIN_COMMENT_ADDED',
      priority: 'MEDIUM',
      recipientId: executiveUser.id,
      recipientRole: Role.EXECUTIVE,
      actionUrl: '/executive/visit-history',
      metadata: {
        storeName: 'Fashion Hub',
        comment: 'Please provide more details about customer interaction'
      }
    });

    // 5. System Announcement (URGENT priority)
    await NotificationService.createNotification({
      title: '📢 Urgent: System Maintenance',
      message: 'Emergency maintenance scheduled for today 6 PM - 8 PM. Please save all work and log out before 6 PM.',
      type: 'SYSTEM_ANNOUNCEMENT',
      priority: 'URGENT',
      recipientId: executiveUser.id,
      recipientRole: Role.EXECUTIVE,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
      metadata: {
        isSystemAnnouncement: true,
        maintenanceWindow: '6 PM - 8 PM'
      }
    });

    // 6. Another Issue Assignment (URGENT priority) 
    await NotificationService.createNotification({
      title: '🚨 Urgent Issue Assigned',
      message: 'URGENT: Critical issue at MegaMart requires immediate attention. Customer complaint about product display.',
      type: 'ISSUE_ASSIGNED',
      priority: 'URGENT',
      recipientId: executiveUser.id,
      recipientRole: Role.EXECUTIVE,
      actionUrl: '/executive/assignments',
      metadata: {
        storeName: 'MegaMart',
        issueDetails: 'Customer complaint - product display issues',
        urgentReason: 'Customer escalation'
      }
    });

    console.log('✅ Created 6 test notifications successfully!');

    // Get notification count
    const count = await NotificationService.getUnreadCount(executiveUser.id, Role.EXECUTIVE);
    console.log(`📊 Total unread notifications: ${count}`);

    console.log('\n🎉 Test notifications created! You can now:');
    console.log('1. Visit the executive dashboard to see the notification badge');
    console.log('2. Click the notification bell to see the dropdown');
    console.log('3. Visit /executive/notifications to see the full notification page');
    console.log('4. Test marking notifications as read and archiving them');

  } catch (error) {
    console.error('❌ Error creating test notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test function
createTestNotifications();

export { createTestNotifications };
