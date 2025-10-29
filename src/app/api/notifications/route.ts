import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { NotificationService, NotificationFilters } from '@/lib/notification';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filters: NotificationFilters = {
      status: searchParams.get('status') as any,
      type: searchParams.get('type') as any,
      priority: searchParams.get('priority') as any,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };

    // Remove null values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof NotificationFilters] === null) {
        delete filters[key as keyof NotificationFilters];
      }
    });

    // Convert string role to Prisma Role enum
    const roleEnum = Role[user.role as keyof typeof Role];
    
    const notifications = await NotificationService.getUserNotifications(
      user.userId,
      roleEnum,
      filters
    );

    return NextResponse.json({
      success: true,
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationIds, action } = body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 });
    }

    switch (action) {
      case 'markAsRead':
        if (notificationIds.length === 1) {
          await NotificationService.markAsRead(notificationIds[0]);
        } else {
          await NotificationService.markMultipleAsRead(notificationIds);
        }
        break;

      case 'archive':
        // Archive notifications one by one
        await Promise.all(
          notificationIds.map(id => NotificationService.archiveNotification(id))
        );
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
