import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Await params in Next.js 15
    const { id } = await params;

    // Find the issue by ID with both physical and digital visit relations
    const targetIssue = await prisma.issue.findUnique({
      where: { id },
      include: {
        visit: {
          include: {
            executive: { select: { id: true, name: true } },
            store: { select: { id: true, storeName: true, city: true, fullAddress: true, partnerBrandIds: true } }
          }
        },
        digitalVisit: {
          include: {
            executive: { select: { id: true, name: true } },
            store: { select: { id: true, storeName: true, city: true, fullAddress: true, partnerBrandIds: true } }
          }
        },
        assigned: {
          include: {
            executive: { select: { name: true } },
            assignReport: { select: { remarks: true, personMetName: true, personMetDesignation: true, photoUrls: true, createdAt: true } }
          }
        }
      }
    });

    if (!targetIssue) {
      return NextResponse.json(
        { error: 'Issue not found' }, 
        { status: 404 }
      );
    }

    // Get all brands for brand mapping
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        brandName: true
      }
    });
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Choose source (physical or digital)
    const source: any = targetIssue.visit ?? targetIssue.digitalVisit;

    // Build brand list
    let partnerBrandNames: string[] = [];
    if (targetIssue.visit && Array.isArray((targetIssue.visit as any).brandIds)) {
      const visitBrands = (targetIssue.visit as any).brandIds
        .map((brandId: string) => brandMap.get(brandId))
        .filter(Boolean) as string[];
      partnerBrandNames = visitBrands;
    } else if (source?.store && Array.isArray((source.store as any).partnerBrandIds)) {
      const pb = (source.store as any).partnerBrandIds
        .map((id: string) => brandMap.get(id))
        .filter(Boolean) as string[];
      partnerBrandNames = pb;
    }
    const brandAssociated = partnerBrandNames[0] || 'Unknown Brand';

    // Process assignment history
    const assignmentHistory = targetIssue.assigned.map(assignment => {
      // Generate initials from executive name
      const executiveInitials = assignment.executive.name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('');

      return {
        id: assignment.id,
        executiveName: assignment.executive.name,
        executiveInitials: executiveInitials,
        dateAssigned: assignment.createdAt.toISOString().split('T')[0],
        status: assignment.status,
        adminComment: assignment.adminComment || '',
        report: assignment.assignReport ? {
          remarks: assignment.assignReport.remarks,
          personMet: assignment.assignReport.personMetName,
          designation: assignment.assignReport.personMetDesignation,
          photos: assignment.assignReport.photoUrls,
          submittedAt: assignment.assignReport.createdAt.toISOString()
        } : null
      };
    });

    // Build the detailed issue response
    const issueDetail = {
      id: targetIssue.id,
      issueId: `#Issue_${targetIssue.id}`,
      storeName: source?.store?.storeName || 'Unknown Store',
      storeId: source?.store?.id || '',
      location: source?.store?.fullAddress || source?.store?.city || 'N/A',
      brandAssociated: brandAssociated,
      city: source?.store?.city || 'N/A',
      dateReported: new Date(targetIssue.createdAt).toISOString().split('T')[0],
      reportedBy: source?.executive?.name || 'Unknown Executive',
      reportedByRole: 'Executive',
      status: targetIssue.status,
      description: targetIssue.details,
      assignmentHistory: assignmentHistory,
      createdAt: targetIssue.createdAt.toISOString(),
      updatedAt: targetIssue.updatedAt.toISOString(),
      // Additional details for the detail page
      executive: {
        id: source?.executive?.id || '',
        name: source?.executive?.name || 'Unknown Executive'
      },
      store: {
        id: source?.store?.id || '',
        name: source?.store?.storeName || 'Unknown Store',
        address: source?.store?.fullAddress || null,
        city: source?.store?.city || 'N/A'
      },
      visit: {
        id: source?.id || '',
        createdAt: (source?.connectDate || source?.createdAt)?.toISOString?.() || (source?.connectDate || source?.createdAt) || '',
        remarks: source?.remarks || ''
      }
    };

    return NextResponse.json(issueDetail);

  } catch (error) {
    console.error('Issue Detail API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

