import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateUniqueIssueId } from '@/lib/issueIdGenerator';

export const runtime = 'nodejs';

// GET — fetch past stakeholder visits for the logged-in executive (filtered by stakeholder)
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.roles.includes('EXECUTIVE')) return NextResponse.json({ error: 'Executive access required' }, { status: 403 });

    const executive = await prisma.employee.findUnique({ where: { userId: user.userId } });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const stakeholderDesignation = searchParams.get('stakeholderDesignation');

    const whereClause: any = { executiveId: executive.id };
    if (brandId) whereClause.brandId = brandId;
    if (stakeholderDesignation) whereClause.stakeholderDesignation = stakeholderDesignation;

    const visits = await prisma.stakeholderVisit.findMany({
      where: whereClause,
      orderBy: { visitDate: 'desc' },
      select: {
        id: true,
        brandId: true,
        brand: { select: { brandName: true } },
        stakeholderDesignation: true,
        visitDate: true,
        status: true,
        personMet: true,
        remarks: true,
        imageUrls: true,
        brandIds: true,
        adminComment: true,
        createdAt: true,
        nextScheduledDate: true,
        employee: {
          select: {
            name: true
          }
        }
      },
    });

    return NextResponse.json({ success: true, visits });
  } catch (error) {
    console.error('Stakeholder Visit GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — submit a new stakeholder visit
export async function POST(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.roles.includes('EXECUTIVE')) return NextResponse.json({ error: 'Executive access required' }, { status: 403 });

    const executive = await prisma.employee.findUnique({ where: { userId: user.userId } });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const body = await request.json();
    const {
      brandId,
      stakeholderDesignation,
      state,
      visitDate,
      personMet,
      remarks,
      imageUrls,
      nextScheduledDate,
      issuesRaised,
    } = body;

    if (!brandId || !stakeholderDesignation) {
      return NextResponse.json({ error: 'Brand ID and designation are required' }, { status: 400 });
    }
    if (!state) {
      return NextResponse.json({ error: 'State is required' }, { status: 400 });
    }
    if (!visitDate) {
      return NextResponse.json({ error: 'Visit date is required' }, { status: 400 });
    }
    if (!personMet || !Array.isArray(personMet) || personMet.length === 0) {
      return NextResponse.json({ error: 'At least one person met is required' }, { status: 400 });
    }

    const visit = await prisma.stakeholderVisit.create({
      data: {
        brandId,
        stakeholderDesignation,
        state,
        visitDate: new Date(visitDate),
        personMet,
        remarks: remarks || null,
        imageUrls: imageUrls || [],
        nextScheduledDate: nextScheduledDate ? new Date(nextScheduledDate) : null,
        executiveId: executive.id,
        status: 'PENDING_REVIEW',
      },
    });

    // Process top-level issues
    let createdIssues: any[] = [];
    if (issuesRaised && Array.isArray(issuesRaised) && issuesRaised.length > 0) {
      for (const issueDetail of issuesRaised) {
        if (issueDetail && issueDetail.trim() !== '') {
          const uniqueIssueId = await generateUniqueIssueId();
          const createdIssue = await prisma.issue.create({
            data: {
              id: uniqueIssueId,
              details: issueDetail.trim(),
              stakeholderVisitId: visit.id,
              status: 'Pending',
            },
          });
          createdIssues.push({
            id: createdIssue.id,
            details: createdIssue.details,
            status: createdIssue.status,
          });
        }
      }
    }

    return NextResponse.json({ success: true, visit: { ...visit, issues: createdIssues } });
  } catch (error) {
    console.error('Stakeholder Visit POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE — delete a stakeholder visit if it's still pending review
export async function DELETE(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.roles.includes('EXECUTIVE')) return NextResponse.json({ error: 'Executive access required' }, { status: 403 });

    const executive = await prisma.employee.findUnique({ where: { userId: user.userId } });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Visit ID is required' }, { status: 400 });
    }

    const existingVisit = await prisma.stakeholderVisit.findUnique({ where: { id } });
    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    if (existingVisit.executiveId !== executive.id) {
      return NextResponse.json({ error: 'Not authorized to delete this visit' }, { status: 403 });
    }

    if (existingVisit.status !== 'PENDING_REVIEW') {
      return NextResponse.json({ error: 'Cannot delete a reviewed visit' }, { status: 400 });
    }

    await prisma.stakeholderVisit.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Visit deleted successfully' });
  } catch (error) {
    console.error('Stakeholder Visit DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
