import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' }, 
        { status: 403 }
      );
    }

    const visitId = params.id;

    // Parse request body for admin comment (optional)
    const body = await request.json().catch(() => ({}));
    const adminComment = body.adminComment || null;

    // Find the visit first to verify it exists
    const existingVisit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        status: true,
        store: {
          select: {
            storeName: true
          }
        },
        executive: {
          select: {
            name: true
          }
        }
      }
    });

    if (!existingVisit) {
      return NextResponse.json(
        { error: 'Visit not found' },
        { status: 404 }
      );
    }

    if (existingVisit.status === 'REVIEWD') {
      return NextResponse.json(
        { error: 'Visit is already reviewed' },
        { status: 400 }
      );
    }

    // Update visit status to REVIEWD
    const updatedVisit = await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'REVIEWD',
        adminComment: adminComment,
        updatedAt: new Date()
      },
      select: {
        id: true,
        status: true,
        adminComment: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      message: `Visit for ${existingVisit.store.storeName} by ${existingVisit.executive.name} has been marked as reviewed`,
      visit: updatedVisit
    });

  } catch (error) {
    console.error('Mark Visit Reviewed API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}