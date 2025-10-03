import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest, ctx?: { params?: { id?: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'EXECUTIVE' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Resolve visitId robustly: prefer route params, else derive from URL
    let visitId = ctx?.params?.id;
    if (!visitId) {
      const url = new URL(request.url);
      const parts = url.pathname.split('/').filter(Boolean);
      visitId = parts[parts.length - 1];
    }
    if (!visitId || visitId === 'route.ts') return NextResponse.json({ error: 'Visit id is required' }, { status: 400 });

    // Load digital visit
    const visit = await prisma.digitalVisit.findUnique({
      where: { id: visitId },
      select: { id: true, executiveId: true, status: true }
    });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    // Ownership check for executives; admins can delete any
    if (user.role === 'EXECUTIVE') {
      const executive = await prisma.executive.findUnique({ where: { userId: user.userId } });
      if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
      if (visit.executiveId !== executive.id) {
        return NextResponse.json({ error: 'You are not allowed to delete this visit' }, { status: 403 });
      }
    }

    if (visit.status === 'REVIEWD' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Reviewed visits cannot be deleted' }, { status: 400 });
    }

    // Fetch dependent issues and assignments for this digital visit
    const issues = await prisma.issue.findMany({
      where: { digitalVisitId: visitId },
      select: { id: true, assigned: { select: { id: true } } }
    });

    const issueIds = issues.map(i => i.id);
    const assignedIds = issues.flatMap(i => i.assigned?.map(a => a.id) || []);

    await prisma.$transaction([
      // Related notifications
      prisma.notification.deleteMany({
        where: {
          OR: [
            { visitId: visitId },
            issueIds.length ? { issueId: { in: issueIds } } : undefined,
            assignedIds.length ? { assignedId: { in: assignedIds } } : undefined
          ].filter(Boolean) as any
        }
      }),
      // Assignments
      prisma.assigned.deleteMany({ where: issueIds.length ? { issueId: { in: issueIds } } : { issueId: '' } }),
      // Issues
      prisma.issue.deleteMany({ where: { digitalVisitId: visitId } }),
      // Finally delete the digital visit
      prisma.digitalVisit.delete({ where: { id: visitId } })
    ]);

    return NextResponse.json({ success: true, message: 'Visit deleted' });
  } catch (error) {
    console.error('Error deleting digital visit:', error);
    return NextResponse.json({ error: 'Failed to delete visit' }, { status: 500 });
  }
}
