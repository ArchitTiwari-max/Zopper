import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.employee.findUnique({
      where: { userId: user.id || (user as any).userId }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const { nextScheduledDate } = await request.json();

    if (!nextScheduledDate) {
      return NextResponse.json({ error: 'nextScheduledDate is required' }, { status: 400 });
    }

    const visit = await prisma.stakeholderVisit.update({
      where: { id: params.id },
      data: {
        nextScheduledDate: new Date(nextScheduledDate)
      }
    });

    return NextResponse.json({ success: true, visit });
  } catch (error) {
    console.error('Stakeholder Visit Reschedule Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
