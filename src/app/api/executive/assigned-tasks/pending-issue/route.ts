import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AssignedStatus } from '@prisma/client';

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

    // Check if cache busting is requested (timestamp parameter)
    const url = new URL(request.url);
    const bustCache = url.searchParams.has('t');
    
    // Generate ETag for cache validation (1-minute intervals) - skip if cache busting
    let etag = '';
    if (!bustCache) {
      const currentTime = Math.floor(Date.now() / (1 * 60 * 1000)) * (1 * 60 * 1000);
      etag = `"${currentTime}-${executive.id}-tasks"`;
      
      // Check if client has cached version (conditional request)
      const ifNoneMatch = request.headers.get('if-none-match');
      if (ifNoneMatch === etag) {
        // Return 304 Not Modified if ETag matches
        return new NextResponse(null, { 
          status: 304,
          headers: {
            'Cache-Control': 'public, max-age=60, s-maxage=60',
            'ETag': etag
          }
        });
      }
    }

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
                }
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
      
      // Add caching headers conditionally
      if (bustCache) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      } else {
        response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
        response.headers.set('CDN-Cache-Control', 'public, max-age=60');
        response.headers.set('ETag', etag);
      }
      
      return response;
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
          adminComment: assigned.adminComment,
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

    // Create response with cache headers
    const response = NextResponse.json({
      success: true,
      data: {
        tasks: sortedTasks
      }
    });

    // Add caching headers conditionally
    if (bustCache) {
      // No caching for cache-busted requests
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    } else {
      // Normal caching for regular requests
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      response.headers.set('CDN-Cache-Control', 'public, max-age=60');
      response.headers.set('Vary', 'User-Agent');
      response.headers.set('ETag', etag);
    }
    
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
  }
}
