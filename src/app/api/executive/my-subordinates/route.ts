import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/executive/my-subordinates
 * Returns the list of direct subordinates (id + name) for the
 * authenticated executive. Used to populate the "Filter by Subordinate"
 * dropdown on the Subordinate Visits page — independent of visit data so
 * all subordinates appear even if they have no visits in the selected range.
 */
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. Executive role required.' },
        { status: 403 },
      );
    }

    // Fetch this executive's subordinateIds
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { subordinateIds: true },
    });

    if (!executive) {
      return NextResponse.json(
        { error: 'Executive profile not found' },
        { status: 404 },
      );
    }

    const subordinateIds = executive.subordinateIds ?? [];

    if (subordinateIds.length === 0) {
      return NextResponse.json({ subordinates: [] });
    }

    // Fetch name for every subordinate id
    const subordinates = await prisma.executive.findMany({
      where: { id: { in: subordinateIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const response = NextResponse.json({ subordinates });
    // Prevent caching so the user gets the correct subordinates instantly after switching accounts
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    console.error('Error fetching subordinates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subordinates', details: error.message },
      { status: 500 },
    );
  }
}
