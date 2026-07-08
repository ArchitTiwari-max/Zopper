import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userHeader = request.headers.get('x-user-data');
    if (!userHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = JSON.parse(userHeader);
    const body = await request.json().catch(() => ({}));
    
    const { visitId, type, remark } = body;

    if (!visitId || !type || !remark) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let existingVisit: any = null;

    // Find the visit based on type
    if (type === 'Digital') {
      existingVisit = await prisma.digitalVisit.findUnique({
        where: { id: visitId },
        select: {
          id: true,
          remarks: true,
          executiveId: true,
        }
      });
    } else {
      existingVisit = await prisma.visit.findUnique({
        where: { id: visitId },
        select: {
          id: true,
          remarks: true,
          executiveId: true,
        }
      });
    }

    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Generate unique issue ID
    const issueId = new Date().getTime().toString().slice(-7);
    
    // Create an issue from the visit
    const createdIssue = await prisma.issue.create({
      data: {
        id: issueId,
        details: existingVisit.remarks || 'Manager added a remark for this visit',
        createdBy: 'EXECUTIVE', // Manager is an executive role here
        status: 'Assigned',
        visitId: type === 'Physical' ? visitId : undefined,
        digitalVisitId: type === 'Digital' ? visitId : undefined,
      }
    });

    // Create assignment to the executive who created the visit
    const createdAssignment = await prisma.assigned.create({
      data: {
        adminComment: remark,
        status: 'Assigned',
        issueId: createdIssue.id,
        executiveId: existingVisit.executiveId
      }
    });

    return NextResponse.json({
      success: true,
      message: `Remark added and issue #${createdIssue.id} assigned to the executive.`,
      issue: createdIssue,
      assignment: createdAssignment
    });

  } catch (error) {
    console.error('Manager Remark API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
