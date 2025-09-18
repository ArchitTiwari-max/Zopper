import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateAndRefreshToken } from '@/lib/auth';
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

    // Execute all queries in parallel to avoid N+1 problem
    const [executive, pendingIssuesCount, visitPlans] = await Promise.all([
      // Get executive profile
      prisma.executive.findUnique({
        where: { userId: user.userId }
      }),
      
      // Get pending issues count directly from database
      prisma.assigned.count({
        where: {
          executive: { userId: user.userId }, // Join through executive relationship
          OR: [
            { status: AssignedStatus.Assigned },
            { status: AssignedStatus.In_Progress }
          ],
          assignReport: {
            is: null // No report submitted
          }
        }
      }),
      
      // Get visit plans for counting (only what we need)
      prisma.visitPlan.findMany({
        where: {
          executive: { userId: user.userId } // Join through executive relationship
        },
        select: {
          storesSnapshot: true
        }
      })
    ]);

    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }

    // Count stores with SUBMITTED status from all visit plans (application level - unavoidable due to JSON field)
    let pendingVisitsCount = 0;
    visitPlans.forEach(plan => {
      const storesSnapshot = plan.storesSnapshot as any[] || [];
      const submittedStores = storesSnapshot.filter(store => 
        store.status === 'SUBMITTED' || !store.status // Default to SUBMITTED if no status
      );
      pendingVisitsCount += submittedStores.length;
    });

    // Generate ETag for cache validation (1-minute intervals)
    const currentTime = Math.floor(Date.now() / (1 * 60 * 1000)) * (1 * 60 * 1000);
    const etag = `"${currentTime}-${executive.id}-counts"`;
    
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

    // Create response
    const response = NextResponse.json({
      success: true,
      data: {
        pendingIssuesCount,
        pendingVisitsCount,
        totalPendingCount: pendingIssuesCount + pendingVisitsCount,
        executiveId: executive.id,
        timestamp: new Date().toISOString()
      }
    });

    // Add caching headers - cache for 1 minute
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    response.headers.set('CDN-Cache-Control', 'public, max-age=60');
    response.headers.set('Vary', 'User-Agent');
    response.headers.set('ETag', etag);
    
    return response;

  } catch (error) {
    console.error('Fetch counts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch counts' },
      { status: 500 }
    );
  }
}