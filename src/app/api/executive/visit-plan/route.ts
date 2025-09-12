import { NextRequest, NextResponse } from 'next/server';
import { validateAndRefreshToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const authResult = await validateAndRefreshToken(request);
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user is an executive
    if (authResult.user!.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Only executives can submit visit plans' }, { status: 403 });
    }

    const body = await request.json();
    const { storeIds } = body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json({ error: 'Invalid store IDs provided' }, { status: 400 });
    }

    // Get executive details
    const executive = await prisma.executive.findUnique({
      where: { userId: authResult.user!.userId },
      include: { user: true }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Get store details for the selected stores
    const stores = await prisma.store.findMany({
      where: {
        id: { in: storeIds }
      },
      select: {
        id: true,
        storeName: true,
        city: true,
        fullAddress: true
      }
    });

    if (stores.length !== storeIds.length) {
      return NextResponse.json({ error: 'Some stores were not found' }, { status: 400 });
    }

    // Get all admin users to notify
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true }
    });

    if (adminUsers.length === 0) {
      return NextResponse.json({ error: 'No admin users found to notify' }, { status: 500 });
    }

    // Create a VisitPlan (PJP) record
    const storesSnapshot = stores.map(s => ({ id: s.id, storeName: s.storeName, city: s.city, fullAddress: s.fullAddress }));
    const visitPlan = await prisma.visitPlan.create({
      data: {
        executiveId: executive.id,
        storeIds: storeIds,
        storesSnapshot: storesSnapshot as any,
        status: 'SUBMITTED'
      }
    });

    // Create visit plan submission notification for each admin
    const storeNames = stores.map(store => store.storeName);
    const storeCount = stores.length;
    const storeList = storeNames.length > 3 
      ? `${storeNames.slice(0, 3).join(', ')} and ${storeNames.length - 3} more`
      : storeNames.join(', ');

    const { NotificationService } = await import('@/lib/notification');

    const notificationPromises = adminUsers.map(admin => 
      NotificationService.createNotification({
        title: '📋 New Visit Plan Submitted',
        message: `${executive.name} has submitted a visit plan for ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}: ${storeList}`,
        type: 'VISIT_PLAN_SUBMITTED',
        priority: 'MEDIUM',
        recipientId: admin.id,
        recipientRole: Role.ADMIN,
        senderId: authResult.user!.userId,
        senderRole: Role.EXECUTIVE,
        actionUrl: '/admin/visit-plans',
        metadata: {
          planId: visitPlan.id,
          executiveName: executive.name,
          executiveEmail: executive.user.email,
          storeCount: storeCount,
          storeIds: storeIds,
          storeNames: storeNames,
          submissionTime: new Date().toISOString()
        },
        visitPlanId: visitPlan.id
      })
    );

    // Wait for all notification creations to complete
    const notificationResults = await Promise.allSettled(notificationPromises);
    
    // Check if any notifications failed
    const failedNotifications = notificationResults.filter(result => result.status === 'rejected');
    if (failedNotifications.length > 0) {
      console.warn('Some notifications failed to send:', failedNotifications);
    }

    // Log the visit plan submission for audit purposes
    console.log(`📋 Visit plan submitted by ${executive.name} (${executive.user.email}):`, {
      executiveId: executive.id,
      planId: visitPlan.id,
      storeCount: storeCount,
      stores: stores.map(s => ({ id: s.id, name: s.storeName, city: s.city })),
      notificationsSent: notificationResults.filter(r => r.status === 'fulfilled').length,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Visit plan submitted successfully for ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}`,
      data: {
        plan: visitPlan,
        submittedStores: stores,
        notificationsSent: notificationResults.filter(r => r.status === 'fulfilled').length,
        totalAdmins: adminUsers.length
      }
    });

  } catch (error) {
    console.error('Error submitting visit plan:', error);
    return NextResponse.json(
      { error: 'Failed to submit visit plan' },
      { status: 500 }
    );
  }
}

// GET method to retrieve submitted visit plans (for admin view)
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateAndRefreshToken(request);
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can view all visit plans
    if (authResult.user!.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can view visit plans' }, { status: 403 });
    }

    // Fetch all visit plans with related data
    const visitPlans = await prisma.visitPlan.findMany({
      include: {
        executive: {
          include: {
            user: true
          }
        },
        notifications: {
          where: {
            recipientId: authResult.user!.userId
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    // Transform the data to include store details from snapshot
    const transformedPlans = visitPlans.map(plan => ({
      id: plan.id,
      status: plan.status,
      submittedAt: plan.submittedAt,
      reviewedAt: plan.reviewedAt,
      reviewNote: plan.reviewNote,
      executive: {
        id: plan.executive.id,
        name: plan.executive.name,
        email: plan.executive.user.email
      },
      storeCount: plan.storeIds.length,
      stores: plan.storesSnapshot || [],
      hasUnreadNotifications: plan.notifications.some(n => n.status === 'UNREAD')
    }));

    return NextResponse.json({
      success: true,
      data: transformedPlans,
      totalPlans: transformedPlans.length
    });

  } catch (error) {
    console.error('Error fetching visit plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visit plans' },
      { status: 500 }
    );
  }
}
