import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stores = await prisma.store.findMany({
      select: {
        id: true,
        storeName: true,
      },
      orderBy: {
        storeName: 'asc'
      }
    });

    return NextResponse.json({ success: true, stores });
  } catch (error) {
    console.error('Stores List API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
