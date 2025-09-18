import { NextRequest, NextResponse } from 'next/server';
import { validateAndRefreshToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET method for executive to retrieve their visit plans
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateAndRefreshToken(request);
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user is an executive
    if (authResult.user!.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Only executives can view their visit plans' }, { status: 403 });
    }

    // Fetch executive and visit plans in parallel to avoid N+1
    const [executive, visitPlans] = await Promise.all([
      prisma.executive.findUnique({
        where: { userId: authResult.user!.userId },
        select: { id: true, name: true } // Only select what we need
      }),
      
      prisma.visitPlan.findMany({
        where: {
          executive: { userId: authResult.user!.userId } // Join through executive relationship
        },
        select: {
          id: true,
          storesSnapshot: true,
          plannedVisitDate: true,
          submittedAt: true,
          createdByRole: true,
          adminComment: true,
          status: true
        },
        orderBy: {
          plannedVisitDate: 'asc' // Upcoming visits first
        }
      })
    ]);

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Flatten the data to show each store as a separate row
    const flattenedStores: any[] = [];
    
    visitPlans.forEach(plan => {
      const storesSnapshot = plan.storesSnapshot as any[] || [];
      
      // Create a row for each store in the visit plan
      storesSnapshot.forEach(store => {
        flattenedStores.push({
          planId: plan.id,
          storeId: store.id,
          storeName: store.storeName,
          city: store.city,
          fullAddress: store.fullAddress,
          plannedVisitDate: plan.plannedVisitDate,
          submittedAt: plan.submittedAt,
          createdByRole: plan.createdByRole || 'EXECUTIVE',
          adminComment: plan.adminComment,
          status: store.status || 'SUBMITTED', // Use individual store status
          documentStatus: plan.status // Keep document status for reference
        });
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        visitPlans: flattenedStores
      }
    });

  } catch (error) {
    console.error('Error fetching executive visit plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visit plans' },
      { status: 500 }
    );
  }
}

// PUT method to mark individual store as completed
export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateAndRefreshToken(request);
    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user is an executive
    if (authResult.user!.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Only executives can update their visit plans' }, { status: 403 });
    }

    const body = await request.json();
    const { planId, storeId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Get visit plan and verify executive ownership in single query
    const visitPlan = await prisma.visitPlan.findFirst({
      where: {
        id: planId,
        executive: { userId: authResult.user!.userId } // Join through executive relationship
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

    // Get the current storesSnapshot
    const currentStoresSnapshot = visitPlan.storesSnapshot as any[] || [];
    
    // Find and update the specific store status
    const updatedStoresSnapshot = currentStoresSnapshot.map(store => {
      if (store.id === storeId) {
        return { ...store, status: 'COMPLETED' };
      }
      return store;
    });
    
    // Check if all stores are now completed
    const allStoresCompleted = updatedStoresSnapshot.every(store => store.status === 'COMPLETED');
    
    // Update the visit plan
    const updateData: any = {
      storesSnapshot: updatedStoresSnapshot
    };
    
    // Only update document status if all stores are completed
    if (allStoresCompleted) {
      updateData.status = 'COMPLETED';
      updateData.reviewedAt = new Date();
    }
    
    const updatedPlan = await prisma.visitPlan.update({
      where: { id: planId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: allStoresCompleted ? 'All stores completed! Visit plan marked as completed.' : 'Store marked as completed',
      data: {
        plan: updatedPlan,
        completedStore: storeId,
        allStoresCompleted: allStoresCompleted
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