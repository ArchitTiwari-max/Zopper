import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AssignedStatus } from '@prisma/client';

export const runtime = 'nodejs';

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

    // No caching - always return fresh data for immediate updates

    // Fetch assigned tasks for this executive with optimized query (select only needed fields)
    const assignedTasks = await prisma.assigned.findMany({
      where: {
        executiveId: executive.id
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        adminComment: true,
        issue: {
          select: {
            id: true,
            details: true,
            visit: {
              select: {
                id: true,
                store: {
                  select: {
                    id: true,
                    storeName: true,
                    city: true,
                    fullAddress: true,
                    partnerBrandIds: true
                  }
                },
                createdAt: true,
                status: true
              }
            },
            digitalVisit: {
              select: {
                id: true,
                store: {
                  select: {
                    id: true,
                    storeName: true,
                    city: true,
                    fullAddress: true,
                    partnerBrandIds: true
                  }
                },
                connectDate: true,
                status: true,
                remarks: true
              }
            }
          }
        },
        assignReport: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Handle empty tasks case
    if (assignedTasks.length === 0) {
      const response = NextResponse.json({
        success: true,
        data: {
          tasks: []
        }
      });
      
      // No caching for immediate updates
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    }

    // Transform the data to match the frontend interface
    const transformedTasks = assignedTasks.map(assigned => {
      try {
        const source = assigned.issue.visit ?? assigned.issue.digitalVisit;
        const store = source?.store;
        return {
          id: assigned.id,
          storeName: store?.storeName || 'Unknown Store',
          storeDetails: {
            id: store?.id || '',
            storeName: store?.storeName || 'Unknown Store',
            city: store?.city || '',
            fullAddress: store?.fullAddress || null,
            partnerBrandIds: store?.partnerBrandIds || []
          },
          issue: assigned.issue.details,
          city: store?.city || '',
          status: assigned.status,
          hasReport: !!assigned.assignReport,
          createdAt: assigned.createdAt,
          assignedAt: assigned.createdAt,
          adminComment: assigned.adminComment,
          issueId: assigned.issue.id,
          visitId: source?.id || '',
          storeId: store?.id || ''
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

    // Sort tasks to prioritize PENDING status first
    const sortedTasks = transformedTasks.sort((a, b) => {
      // Determine display status for both tasks (same logic as frontend)
      const displayStatusA = a.status === AssignedStatus.Completed || a.hasReport ? 'Submitted' : 'Pending';
      const displayStatusB = b.status === AssignedStatus.Completed || b.hasReport ? 'Submitted' : 'Pending';
      
      // Sort PENDING first, then SUBMITTED
      if (displayStatusA === 'Pending' && displayStatusB === 'Submitted') return -1;
      if (displayStatusA === 'Submitted' && displayStatusB === 'Pending') return 1;
      
      // Within same display status, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Create response with no caching for immediate updates
    const response = NextResponse.json({
      success: true,
      data: {
        tasks: sortedTasks
      }
    });

    // No caching for immediate updates
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Content-Type-Options', 'nosniff'); // Security
    
    return response;

  } catch (error) {
    console.error('Fetch assigned tasks error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assigned tasks' },
      { status: 500 }
    );
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
            visit: { include: { store: true } },
            digitalVisit: { include: { store: true } }
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
    const source = (assignedTask as any).issue.visit ?? (assignedTask as any).issue.digitalVisit;
    const store = source?.store;

    const taskDetails = {
      id: assignedTask.id,
      storeName: store?.storeName || 'Unknown Store',
      storeDetails: {
        id: store?.id || '',
        storeName: store?.storeName || 'Unknown Store',
        city: store?.city || '',
        fullAddress: store?.fullAddress || null,
        partnerBrandIds: store?.partnerBrandIds || []
      },
      issue: {
        id: assignedTask.issue.id,
        details: assignedTask.issue.details,
        status: assignedTask.issue.status,
        createdAt: assignedTask.issue.createdAt
      },
      visit: {
        id: source?.id || '',
        createdAt: (source?.connectDate || source?.createdAt) || null,
        status: source?.status || null
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
  }
}
