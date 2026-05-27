import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, storeIds } = body;

    if (!planId || !Array.isArray(storeIds)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Update the visit plan with new store IDs
    await prisma.visitPlan.update({
      where: { id: planId },
      data: {
        storeIds: storeIds
      }
    });

    return NextResponse.json({ success: true, message: 'Stores updated successfully' });
  } catch (error) {
    console.error('Update Stores API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
