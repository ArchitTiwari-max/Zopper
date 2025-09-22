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

    // Ensure the user is an admin
    if (authResult.user!.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can create visit plans' }, { status: 403 });
    }

    const body = await request.json();
    const { storeIds, executiveId, adminComment, plannedVisitDate } = body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json({ error: 'Invalid store IDs provided' }, { status: 400 });
    }

    if (!executiveId) {
      return NextResponse.json({ error: 'Executive assignment is required' }, { status: 400 });
    }

    if (!plannedVisitDate) {
      return NextResponse.json({ error: 'Planned visit date is required' }, { status: 400 });
    }

    // Get admin details
    const admin = await prisma.admin.findUnique({
      where: { userId: authResult.user!.userId },
      include: { user: true }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });
    }

    // Get executive details with store assignments
    const executive = await prisma.executive.findUnique({
      where: { id: executiveId },
      include: { 
        user: true,
        executiveStores: {
          select: {
            storeId: true
          }
        }
      }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive not found' }, { status: 404 });
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

    // CRITICAL VALIDATION: Check if executive is assigned to all selected stores
    const assignedStoreIds = executive.executiveStores.map(es => es.storeId);
    const unassignedStoreIds = storeIds.filter(storeId => !assignedStoreIds.includes(storeId));
    
    if (unassignedStoreIds.length > 0) {
      const unassignedStoreNames = stores
        .filter(store => unassignedStoreIds.includes(store.id))
        .map(store => store.storeName);
      
      return NextResponse.json({ 
        error: `These stores do not come under executive ${executive.name}: ${unassignedStoreNames.join(', ')}`,
        message: 'Please assign the executive to these stores first before creating a visit plan.',
        code: 'STORES_NOT_ASSIGNED_TO_EXECUTIVE',
        executiveName: executive.name,
        unassignedStores: unassignedStoreNames,
        unassignedStoreIds: unassignedStoreIds
      }, { status: 400 });
    }

    // Create a VisitPlan created by admin
    const storesSnapshot = stores.map(s => ({ 
      id: s.id, 
      storeName: s.storeName, 
      city: s.city, 
      fullAddress: s.fullAddress 
    }));
    
    const visitPlan = await prisma.visitPlan.create({
      data: {
        executiveId: executive.id,
        storeIds: storeIds,
        storesSnapshot: storesSnapshot as any,
        status: 'SUBMITTED',
        plannedVisitDate: new Date(plannedVisitDate),
        createdByAdminId: admin.id,
        adminComment: adminComment || null,
        createdByRole: 'ADMIN'
      }
    });

    // Create visit plan assignment notification for the executive
    const storeNames = stores.map(store => store.storeName);
    const storeCount = stores.length;
    const storeList = storeNames.length > 3 
      ? `${storeNames.slice(0, 3).join(', ')} and ${storeNames.length - 3} more`
      : storeNames.join(', ');

    const { NotificationService } = await import('@/lib/notification');

    // Notify the assigned executive
    await NotificationService.createNotification({
      title: '📋 New Visit Plan Assigned',
      message: `Admin ${admin.name} has assigned you a visit plan for ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}: ${storeList}${adminComment ? '. Comment: ' + adminComment : ''}`,
      type: 'VISIT_PLAN_ASSIGNED',
      priority: 'HIGH',
      recipientId: executive.userId,
      recipientRole: Role.EXECUTIVE,
      senderId: authResult.user!.userId,
      senderRole: Role.ADMIN,
      actionUrl: '/executive/visit-plans',
      metadata: {
        planId: visitPlan.id,
        adminName: admin.name,
        adminComment: adminComment,
        storeCount: storeCount,
        storeIds: storeIds,
        storeNames: storeNames,
        assignedTime: new Date().toISOString(),
        createdByRole: 'ADMIN'
      },
      visitPlanId: visitPlan.id
    });

    // Log the visit plan assignment for audit purposes
    console.log(`📋 Visit plan assigned by Admin ${admin.name} to Executive ${executive.name}:`, {
      adminId: admin.id,
      executiveId: executive.id,
      planId: visitPlan.id,
      storeCount: storeCount,
      stores: stores.map(s => ({ id: s.id, name: s.storeName, city: s.city })),
      adminComment: adminComment,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Visit plan assigned successfully to ${executive.name} for ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}`,
      data: {
        plan: visitPlan,
        assignedTo: {
          id: executive.id,
          name: executive.name,
          email: executive.user.email
        },
        assignedStores: stores,
        adminComment: adminComment
      }
    });

  } catch (error) {
    console.error('Error creating admin visit plan:', error);
    return NextResponse.json(
      { error: 'Failed to create visit plan' },
      { status: 500 }
    );
  }
}

// GET method to retrieve all executives for assignment dropdown
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateAndRefreshToken(request);
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can access this
    if (authResult.user!.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can access executive list' }, { status: 403 });
    }

    // Fetch all executives
    const executives = await prisma.executive.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform the data for dropdown
    const executiveOptions = executives.map(exec => ({
      id: exec.id,
      name: exec.name,
      email: exec.user.email,
      region: exec.region,
      contactNumber: exec.contact_number
    }));

    return NextResponse.json({
      success: true,
      data: executiveOptions,
      totalExecutives: executiveOptions.length
    });

  } catch (error) {
    console.error('Error fetching executives:', error);
    return NextResponse.json(
      { error: 'Failed to fetch executives' },
      { status: 500 }
    );
  }
}
