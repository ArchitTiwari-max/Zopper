import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/executive/is-manager
 * Lightweight check — only reads subordinateIds from the Executive row.
 * Used by the store page to conditionally show the Alignment Index button.
 */
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user || user.role !== 'EXECUTIVE') {
      return NextResponse.json({ isManager: false });
    }

    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { subordinateIds: true },
    });

    const isManager = (executive?.subordinateIds?.length ?? 0) > 0;

    return NextResponse.json({ isManager }, {
      headers: {
        'Cache-Control': 'private, max-age=60', // cache for 1 min per session
      },
    });
  } catch {
    return NextResponse.json({ isManager: false });
  }
}
