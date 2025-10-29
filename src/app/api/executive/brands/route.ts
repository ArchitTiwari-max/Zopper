import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an executive
    if (user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
    }

    // Fetch all brands from database
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        brandName: true,
        // category field removed - using CategoryBrand relation
      },
      orderBy: {
        brandName: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      data: brands
    });

  } catch (error) {
    console.error('Fetch brands error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch brands' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
