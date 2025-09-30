import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// GET method for executive to retrieve their visit plans
export async function GET(request: NextRequest) {
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

    // Get executive data first
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      include: {
        user: true
      }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    // Fetch visit plans with updatedAt for cache invalidation
    const visitPlans = await prisma.visitPlan.findMany({
      where: {
        executive: { userId: user.userId } // Join through executive relationship
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
    });

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

    // Create response with no caching for immediate updates
    const response = NextResponse.json({
      success: true,
      data: {
        visitPlans: flattenedStores
      }
    });

    // ===== NO CACHE HEADERS FOR IMMEDIATE UPDATES =====
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Content-Type-Options', 'nosniff'); // Security

    return response;

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
        executive: { userId: user.userId } // Join through executive relationship
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

    // Create response with cache invalidation
    const response = NextResponse.json({
      success: true,
      message: allStoresCompleted ? 'All stores completed! Visit plan marked as completed.' : 'Store marked as completed',
      data: {
        plan: updatedPlan,
        completedStore: storeId,
        allStoresCompleted: allStoresCompleted
      }
    });

    // ===== CACHE INVALIDATION HEADERS =====
    // Tell browser to not cache this response
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    // Bust related caches by including a timestamp
    response.headers.set('X-Cache-Bust', Date.now().toString());

    return response;

  } catch (error) {
    console.error('Error updating visit plan:', error);
    return NextResponse.json(
      { error: 'Failed to update visit plan' },
      { status: 500 }
    );
  }
}