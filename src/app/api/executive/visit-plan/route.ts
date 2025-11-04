import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const body = await request.json();
    const { storeIds, plannedVisitDate } = body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json({ error: 'Invalid store IDs provided' }, { status: 400 });
    }

    if (!plannedVisitDate) {
      return NextResponse.json({ 
        error: 'Planned visit date is required',
        details: 'Please provide a valid date in YYYY-MM-DD format (e.g., 2025-01-20)'
      }, { status: 400 });
    }

    // Validate and parse the planned visit date
    const visitDate = new Date(plannedVisitDate);
    if (isNaN(visitDate.getTime())) {
      return NextResponse.json({ 
        error: 'Invalid planned visit date format',
        details: `Received: "${plannedVisitDate}". Expected format: YYYY-MM-DD (e.g., 2025-01-20)`
      }, { status: 400 });
    }

    // Additional validation for unrealistic dates
    const currentYear = new Date().getFullYear();
    const visitYear = visitDate.getFullYear();
    
    if (visitYear < 2000 || visitYear > currentYear + 10) {
      return NextResponse.json({
        error: 'Invalid planned visit date',
        details: `Year ${visitYear} is not realistic. Please select a date between 2000 and ${currentYear + 10}`
      }, { status: 400 });
    }

    // Check if the planned date is not in the past
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const visitDateString = visitDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (visitDateString < todayDateString) {
      return NextResponse.json({
        error: 'Past date not allowed',
        details: `Please select today or a future date`
      }, { status: 400 });
    }

    // Get executive details
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
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
    const storesSnapshot = stores.map(s => ({ 
      id: s.id, 
      storeName: s.storeName, 
      city: s.city, 
      fullAddress: s.fullAddress,
      status: 'SUBMITTED' // Default status for each store
    }));
    const visitPlan = await prisma.visitPlan.create({
      data: {
        executiveId: executive.id,
        storeIds: storeIds,
        storesSnapshot: storesSnapshot as any,
        status: 'SUBMITTED',
        plannedVisitDate: visitDate
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
        title: `📋 New Visit Plan Submitted - ${visitDate.toLocaleDateString()}`,
        message: `${executive.name} has submitted a visit plan for ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}: ${storeList}`,
        type: 'VISIT_PLAN_SUBMITTED',
        priority: 'MEDIUM',
        recipientId: admin.id,
        recipientRole: Role.ADMIN,
        senderId: user.userId,
        senderRole: Role.EXECUTIVE,
        actionUrl: '/admin/visit-plans',
        metadata: {
          planId: visitPlan.id,
          executiveName: executive.name,
          storeCount: storeCount,
          storeIds: storeIds,
          storeNames: storeNames,
          plannedVisitDate: visitDate.toISOString(),
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
      { 
        error: 'Failed to submit visit plan',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
