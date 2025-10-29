import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const admin = await prisma.admin.findUnique({ where: { userId: user.userId } });
    if (!admin) return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });

    const id = params.id;

    const existing = await prisma.digitalVisit.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Digital visit not found' }, { status: 404 });
    if (existing.status === 'REVIEWD') {
      return NextResponse.json({ success: true, message: 'Already reviewed' });
    }

    const body = await request.json().catch(() => ({}));
    const adminComment: string | undefined = body?.adminComment;

    const updated = await prisma.digitalVisit.update({
      where: { id },
      data: {
        status: 'REVIEWD',
        reviewedAt: new Date(),
        reviewedByAdmin: { connect: { id: admin.id } },
        adminComment: adminComment || undefined,
      },
      include: { reviewedByAdmin: true },
    });

    return NextResponse.json({ success: true, message: 'Marked as reviewed', visit: updated });
  } catch (e) {
    console.error('Digital mark-reviewed error:', e);
    return NextResponse.json({ error: 'Failed to mark as reviewed' }, { status: 500 });
  }
}
