import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive from user ID
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }

    // Fetch assigned tasks for this executive
    const assignedTasks = await prisma.assigned.findMany({
      where: {
        executiveId: executive.id
      },
      include: {
        issue: {
          include: {
            visit: {
              include: {
                store: true
              }
            }
          }
        },
        assignReport: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Handle empty tasks case
    if (assignedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          tasks: [],
          totalTasks: 0,
          pendingTasks: 0,
          completedTasks: 0
        }
      });
    }

    // Transform the data to match the frontend interface
    const transformedTasks = assignedTasks.map(assigned => {
      try {
        return {
          id: assigned.id,
          storeName: assigned.issue.visit.store.storeName,
          storeDetails: {
            id: assigned.issue.visit.store.id,
            storeName: assigned.issue.visit.store.storeName,
            city: assigned.issue.visit.store.city,
            fullAddress: assigned.issue.visit.store.fullAddress || null,
            partnerBrandIds: assigned.issue.visit.store.partnerBrandIds
          },
          issue: assigned.issue.details,
          city: assigned.issue.visit.store.city,
          status: assigned.status,
          hasReport: !!assigned.assignReport,
          createdAt: assigned.createdAt,
          assignedAt: assigned.createdAt,
          issueId: assigned.issue.id,
          visitId: assigned.issue.visit.id,
          storeId: assigned.issue.visit.store.id
        };
      } catch (transformError) {
        console.error('Error transforming task:', transformError, 'Task ID:', assigned.id);
        // Return a minimal task object if transformation fails
        return {
          id: assigned.id,
          storeName: 'Unknown Store',
          storeDetails: {
            id: '',
            storeName: 'Unknown Store',
            city: '',
            fullAddress: null,
            partnerBrandIds: []
          },
          issue: assigned.issue?.details || 'No issue details',
          city: '',
          status: assigned.status,
          hasReport: !!assigned.assignReport,
          createdAt: assigned.createdAt,
          assignedAt: assigned.createdAt,
          issueId: assigned.issue?.id || '',
          visitId: assigned.issue?.visit?.id || '',
          storeId: ''
        };
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        tasks: transformedTasks,
        totalTasks: transformedTasks.length,
        pendingTasks: transformedTasks.filter(task => task.status === 'Assigned' || task.status === 'In_Progress').length,
        completedTasks: transformedTasks.filter(task => task.status === 'Completed').length
      }
    });

  } catch (error) {
    console.error('Fetch assigned tasks error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assigned tasks' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: GET single assigned task with details
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Get executive from user ID
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }

    // Fetch specific assigned task with all details
    const assignedTask = await prisma.assigned.findFirst({
      where: {
        id: taskId,
        executiveId: executive.id
      },
      include: {
        issue: {
          include: {
            visit: {
              include: {
                store: true
              }
            }
          }
        },
        assignReport: true
      }
    });

    if (!assignedTask) {
      return NextResponse.json(
        { success: false, error: 'Assigned task not found' },
        { status: 404 }
      );
    }

    // Transform the detailed task data
    const taskDetails = {
      id: assignedTask.id,
      storeName: assignedTask.issue.visit.store.storeName,
      storeDetails: {
        id: assignedTask.issue.visit.store.id,
        storeName: assignedTask.issue.visit.store.storeName,
        city: assignedTask.issue.visit.store.city,
        fullAddress: assignedTask.issue.visit.store.fullAddress || null,
        partnerBrandIds: assignedTask.issue.visit.store.partnerBrandIds
      },
      issue: {
        id: assignedTask.issue.id,
        details: assignedTask.issue.details,
        status: assignedTask.issue.status,
        createdAt: assignedTask.issue.createdAt
      },
      visit: {
        id: assignedTask.issue.visit.id,
        createdAt: assignedTask.issue.visit.createdAt,
        status: assignedTask.issue.visit.status
      },
      status: assignedTask.status,
      adminComment: assignedTask.adminComment,
      createdAt: assignedTask.createdAt,
      assignReport: assignedTask.assignReport ? {
        id: assignedTask.assignReport.id,
        remarks: assignedTask.assignReport.remarks,
        personMet: {
          name: assignedTask.assignReport.personMetName,
          designation: assignedTask.assignReport.personMetDesignation
        },
        photoUrls: assignedTask.assignReport.photoUrls,
        createdAt: assignedTask.assignReport.createdAt
      } : null
    };

    return NextResponse.json({
      success: true,
      data: taskDetails
    });

  } catch (error) {
    console.error('Fetch task details error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch task details' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
