import { NextRequest, NextResponse } from 'next/server';
import { validateAndRefreshToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET method to retrieve a specific visit plan for editing
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await validateAndRefreshToken(request);
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user is an executive
    if (authResult.user!.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Only executives can access visit plans' }, { status: 403 });
    }

    const planId = params.id;
    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get executive details
    const executive = await prisma.executive.findUnique({
      where: { userId: authResult.user!.userId },
      select: { id: true, name: true }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Get the visit plan and verify ownership/permissions
    const visitPlan = await prisma.visitPlan.findFirst({
      where: {
        id: planId,
        executiveId: executive.id
      },
      include: {
        executive: {
          select: { id: true, name: true }
        }
      }
    });

    if (!visitPlan) {
      return NextResponse.json({ error: 'Visit plan not found or not authorized' }, { status: 404 });
    }

    // Check if this is an executive-created plan (editable) or admin-assigned (view-only)
    const canEdit = visitPlan.createdByRole === 'EXECUTIVE' && !visitPlan.createdByAdminId;

    // Get store details from the current storeIds
    const stores = await prisma.store.findMany({
      where: {
        id: { in: visitPlan.storeIds }
      },
      select: {
        id: true,
        storeName: true,
        city: true,
        fullAddress: true,
        partnerBrandIds: true
      }
    });

    // Get brand names for the stores
    const allBrandIds = [...new Set(stores.flatMap(store => store.partnerBrandIds || []))];
    const brands = allBrandIds.length > 0 ? await prisma.brand.findMany({
      where: {
        id: { in: allBrandIds }
      },
      select: {
        id: true,
        brandName: true
      }
    }) : [];

    const brandMap = new Map(brands.map(brand => [brand.id, brand.brandName]));

    // Transform stores with partner brand names
    const storesWithBrands = stores.map(store => ({
      id: store.id,
      storeName: store.storeName,
      city: store.city,
      fullAddress: store.fullAddress,
      partnerBrands: store.partnerBrandIds?.map(brandId => brandMap.get(brandId) || 'Unknown Brand') || []
    }));

    return NextResponse.json({
      success: true,
      data: {
        visitPlan: {
          id: visitPlan.id,
          status: visitPlan.status,
          plannedVisitDate: visitPlan.plannedVisitDate,
          createdByRole: visitPlan.createdByRole,
          adminComment: visitPlan.adminComment,
          canEdit: canEdit,
          stores: storesWithBrands
        }
      }
    });

  } catch (error) {
    console.error('Error fetching visit plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visit plan' },
      { status: 500 }
    );
  }
}

// PUT method to update an executive's own visit plan
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await validateAndRefreshToken(request);
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user is an executive
    if (authResult.user!.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Only executives can edit visit plans' }, { status: 403 });
    }

    const planId = params.id;
    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { storeIds, plannedVisitDate } = body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json({ error: 'At least one store is required' }, { status: 400 });
    }

    // Get executive details
    const executive = await prisma.executive.findUnique({
      where: { userId: authResult.user!.userId },
      select: { id: true, name: true }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Get the visit plan and verify ownership/permissions
    const existingPlan = await prisma.visitPlan.findFirst({
      where: {
        id: planId,
        executiveId: executive.id
      }
    });

    if (!existingPlan) {
      return NextResponse.json({ error: 'Visit plan not found or not authorized' }, { status: 404 });
    }

    // Check if this plan can be edited (only executive-created plans)
    if (existingPlan.createdByRole !== 'EXECUTIVE' || existingPlan.createdByAdminId) {
      return NextResponse.json({ 
        error: 'Cannot edit admin-assigned visit plans. You can only view them.' 
      }, { status: 403 });
    }

    // Validate store IDs exist
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

    // Validate planned visit date if provided
    let visitDate = existingPlan.plannedVisitDate;
    if (plannedVisitDate) {
      visitDate = new Date(plannedVisitDate);
      if (isNaN(visitDate.getTime())) {
        return NextResponse.json({ 
          error: 'Invalid planned visit date format',
          details: 'Expected format: YYYY-MM-DD'
        }, { status: 400 });
      }

      // Check if the planned date is not in the past
      const today = new Date();
      const todayDateString = today.toISOString().split('T')[0];
      const visitDateString = visitDate.toISOString().split('T')[0];
      
      if (visitDateString < todayDateString) {
        return NextResponse.json({
          error: 'Past date not allowed',
          details: 'Please select today or a future date'
        }, { status: 400 });
      }
    }

    // Create updated stores snapshot
    const storesSnapshot = stores.map(s => ({ 
      id: s.id, 
      storeName: s.storeName, 
      city: s.city, 
      fullAddress: s.fullAddress,
      status: 'SUBMITTED' // Reset status when editing
    }));

    // Update the visit plan
    const updatedPlan = await prisma.visitPlan.update({
      where: { id: planId },
      data: {
        storeIds: storeIds,
        storesSnapshot: storesSnapshot as any,
        plannedVisitDate: visitDate,
        // Reset to SUBMITTED status when edited
        status: 'SUBMITTED'
      }
    });

    // Notify admins about the updated visit plan
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true }
    });

    if (adminUsers.length > 0) {
      const storeNames = stores.map(store => store.storeName);
      const storeCount = stores.length;
      const storeList = storeNames.length > 3 
        ? `${storeNames.slice(0, 3).join(', ')} and ${storeNames.length - 3} more`
        : storeNames.join(', ');

      const { NotificationService } = await import('@/lib/notification');

      const notificationPromises = adminUsers.map(admin => 
        NotificationService.createNotification({
          title: `📝 Visit Plan Updated - ${visitDate.toLocaleDateString()}`,
          message: `${executive.name} has updated their visit plan for ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}: ${storeList}`,
          type: 'VISIT_PLAN_SUBMITTED',
          priority: 'MEDIUM',
          recipientId: admin.id,
          recipientRole: Role.ADMIN,
          senderId: authResult.user!.userId,
          senderRole: Role.EXECUTIVE,
          actionUrl: '/admin/visit-plans',
          metadata: {
            planId: updatedPlan.id,
            executiveName: executive.name,
            storeCount: storeCount,
            storeIds: storeIds,
            storeNames: storeNames,
            plannedVisitDate: visitDate.toISOString(),
            updateTime: new Date().toISOString(),
            action: 'UPDATED'
          },
          visitPlanId: updatedPlan.id
        })
      );

      await Promise.allSettled(notificationPromises);
    }

    return NextResponse.json({
      success: true,
      message: `Visit plan updated successfully for ${stores.length} ${stores.length === 1 ? 'store' : 'stores'}`,
      data: {
        plan: updatedPlan,
        updatedStores: stores
      }
    });

  } catch (error) {
    console.error('Error updating visit plan:', error);
    return NextResponse.json(
      { error: 'Failed to update visit plan' },
      { status: 500 }
    );
  }
}