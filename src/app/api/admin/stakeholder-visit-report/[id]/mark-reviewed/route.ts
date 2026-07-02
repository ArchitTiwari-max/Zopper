import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const admin = await prisma.admin.findUnique({ where: { userId: user.id } });
    if (!admin) return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });

    const { id } = params;
    const body = await request.json();
    const { adminComment } = body;

    const updated = await prisma.stakeholderVisit.update({
      where: { id },
      data: {
        status: 'REVIEWD',
        adminComment: adminComment || null,
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
      },
      include: {
        reviewedByAdmin: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, visit: updated });
  } catch (error) {
    console.error('Stakeholder Visit mark-reviewed Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
