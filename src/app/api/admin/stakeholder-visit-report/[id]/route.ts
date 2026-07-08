import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Visit ID is required' }, { status: 400 });
    }

    const existingVisit = await prisma.stakeholderVisit.findUnique({ where: { id } });
    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Delete associated issues first
    await prisma.issue.deleteMany({
      where: { stakeholderVisitId: id }
    });

    // Delete the visit
    await prisma.stakeholderVisit.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Visit deleted successfully' });
  } catch (error) {
    console.error('Admin Stakeholder Visit DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
