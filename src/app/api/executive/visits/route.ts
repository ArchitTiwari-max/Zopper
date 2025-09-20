import { NextRequest, NextResponse } from 'next/server';
import { generateUniqueIssueId } from '@/lib/issueIdGenerator';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DEPRECATED: This GET endpoint has been moved to /api/executive/visits/data
// This route now redirects to the new location for backward compatibility
export async function GET(request: NextRequest) {
  // Preserve query parameters in redirect
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const newUrl = `/api/executive/visits/data${searchParams ? `?${searchParams}` : ''}`;
  
  return NextResponse.redirect(new URL(newUrl, url.origin), 301);
}

// POST endpoint to create a new visit with optional issue
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Get executive data
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
    }

    const {
      storeId,
      personMet,
      displayChecked,
      issuesReported,
      brandsVisited,
      remarks,
      imageUrls
    } = await request.json();

    // Validate required fields
    if (!storeId || !personMet || personMet.length === 0) {
      return NextResponse.json({ 
        error: 'Store ID and at least one person met are required' 
      }, { status: 400 });
    }

    // Get brand IDs from brand names
    const brandIds: string[] = [];
    if (brandsVisited && brandsVisited.length > 0) {
      const brands = await prisma.brand.findMany({
        where: {
          brandName: {
            in: brandsVisited
          }
        }
      });
      brandIds.push(...brands.map(brand => brand.id));
    }

    // Create the visit
    const visit = await prisma.visit.create({
      data: {
        personMet: personMet, // JSON array
        POSMchecked: displayChecked || false,
        remarks: remarks || '',
        imageUrls: imageUrls || [],
        status: 'PENDING_REVIEW' as any, // Default status - using enum value
        executiveId: executive.id,
        storeId: storeId,
        brandIds: brandIds
      },
      include: {
        store: true,
        executive: {
          include: {
            user: true
          }
        }
      }
    });

    // Create issue if issuesReported is not null/empty
    let createdIssue = null;
    if (issuesReported && issuesReported.trim() !== '') {
      // Generate unique 7-character issue ID
      const uniqueIssueId = await generateUniqueIssueId();
      
      createdIssue = await prisma.issue.create({
        data: {
          id: uniqueIssueId,
          details: issuesReported.trim(),
          visitId: visit.id,
          status: 'Pending' // Default status
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        visit: {
          id: visit.id,
          status: visit.status,
          createdAt: visit.createdAt
        },
        issue: createdIssue ? {
          id: createdIssue.id,
          details: createdIssue.details,
          status: createdIssue.status
        } : null
      }
    });

  } catch (error) {
    console.error('Error creating visit:', error);
    return NextResponse.json(
      { error: 'Failed to create visit' },
      { status: 500 }
    );
  }
}
