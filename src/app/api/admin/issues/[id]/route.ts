import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user and check if admin
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
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
            employee: { select: { id: true, name: true } },
            store: { select: { id: true, storeName: true, city: true, fullAddress: true, storeBrands: { select: { brandId: true } } } }
          }
        },
        digitalVisit: {
          include: {
            employee: { select: { id: true, name: true } },
            store: { select: { id: true, storeName: true, city: true, fullAddress: true, storeBrands: { select: { brandId: true } } } }
          }
        },
        stakeholderVisit: {
          include: {
            employee: { select: { id: true, name: true } },
            brand: { select: { brandName: true } }
          }
        },
        assigned: {
          include: {
            employee: { select: { name: true } },
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

    // Choose source (physical or digital or stakeholder)
    const source: any = targetIssue.visit ?? targetIssue.digitalVisit ?? targetIssue.stakeholderVisit;

    // Build brand list
    let partnerBrandNames: string[] = [];
    if (targetIssue.stakeholderVisit && (targetIssue.stakeholderVisit as any).brand) {
      partnerBrandNames = [(targetIssue.stakeholderVisit as any).brand.brandName];
    } else if (targetIssue.visit && Array.isArray((targetIssue.visit as any).brandIds)) {
      const visitBrands = (targetIssue.visit as any).brandIds
        .map((brandId: string) => brandMap.get(brandId))
        .filter(Boolean) as string[];
      partnerBrandNames = visitBrands;
    } else if (source?.store && Array.isArray((source.store as any).storeBrands)) {
      const pb = (source.store as any).storeBrands
        .map((sb: any) => brandMap.get(sb.brandId))
        .filter(Boolean) as string[];
      partnerBrandNames = pb;
    }
    const brandAssociated = partnerBrandNames[0] || 'Unknown Brand';

    // Process assignment history
    const assignmentHistory = targetIssue.assigned.map(assignment => {
      // Generate initials from executive name
      const executiveInitials = assignment.employee.name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('');

      return {
        id: assignment.id,
        executiveName: assignment.employee.name,
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
    const storeName = source?.store?.storeName || (targetIssue.stakeholderVisit ? `${(targetIssue.stakeholderVisit as any).brand?.brandName || 'Brand'} - ${(targetIssue.stakeholderVisit as any).stakeholderDesignation}` : 'Unknown Store');
    const location = source?.store?.fullAddress || source?.store?.city || (targetIssue.stakeholderVisit as any)?.state || 'N/A';
    const city = source?.store?.city || (targetIssue.stakeholderVisit as any)?.state || 'N/A';

    const issueDetail = {
      id: targetIssue.id,
      issueId: `#Issue_${targetIssue.id}`,
      storeName: storeName,
      storeId: source?.store?.id || (targetIssue.stakeholderVisit ? 'stakeholder' : ''),
      location: location,
      brandAssociated: brandAssociated,
      city: city,
      dateReported: new Date(targetIssue.createdAt).toISOString().split('T')[0],
      reportedBy: source?.employee?.name || 'Unknown Executive',
      reportedByRole: 'Executive',
      status: targetIssue.status,
      description: targetIssue.details,
      assignmentHistory: assignmentHistory,
      createdAt: targetIssue.createdAt.toISOString(),
      updatedAt: targetIssue.updatedAt.toISOString(),
      // Additional details for the detail page
      employee: {
        id: source?.employee?.id || '',
        name: source?.employee?.name || 'Unknown Executive'
      },
      store: {
        id: source?.store?.id || (targetIssue.stakeholderVisit ? 'stakeholder' : ''),
        name: storeName,
        address: source?.store?.fullAddress || (targetIssue.stakeholderVisit ? `${(targetIssue.stakeholderVisit as any).state}` : null),
        city: city
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

