import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// PATCH /api/executive/store/coordinates
// Body: { storeId: string, latitude: number, longitude: number }
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. Executive role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { storeId, latitude, longitude } = body;

    if (!storeId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'storeId, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.' },
        { status: 400 }
      );
    }

    // Security: ensure this executive is assigned to the store
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        executiveStores: {
          where: { storeId },
          select: { storeId: true },
        },
      },
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    if (executive.executiveStores.length === 0) {
      return NextResponse.json(
        { error: 'You are not assigned to this store.' },
        { status: 403 }
      );
    }

    // Update coordinates
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { latitude, longitude },
      select: { id: true, storeName: true, latitude: true, longitude: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        storeId: updatedStore.id,
        storeName: updatedStore.storeName,
        latitude: updatedStore.latitude,
        longitude: updatedStore.longitude,
      },
    });
  } catch (error) {
    console.error('Error updating store coordinates:', error);
    return NextResponse.json(
      { error: 'Failed to update store coordinates' },
      { status: 500 }
    );
  }
}
