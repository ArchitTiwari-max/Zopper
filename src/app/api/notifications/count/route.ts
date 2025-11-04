import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { NotificationService } from '@/lib/notification';
import { Role } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Convert string role to Prisma Role enum
    const roleEnum = Role[user.role as keyof typeof Role];
    
    const unreadCount = await NotificationService.getUnreadCount(user.userId, roleEnum);

    return NextResponse.json({
      success: true,
      count: unreadCount
    });

  } catch (error) {
    console.error('Error fetching notification count:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
