import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

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

    // Get executive from user ID
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId }
    });

    if (!executive) {
      return NextResponse.json(
        { success: false, error: 'Executive profile not found' },
        { status: 404 }
      );
    }

    // Get date period from query params
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'Last 30 Days';

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get all brands
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        brandName: true,
        category: true
      },
      orderBy: {
        brandName: 'asc'
      }
    });

    // Get visit counts by brand for this executive within the date range
    const brandVisitCounts = await Promise.all(
      brands.map(async (brand) => {
        const visitCount = await prisma.visit.count({
          where: {
            executiveId: executive.id,
            brandIds: {
              has: brand.id
            },
            createdAt: {
              gte: startDate,
              lte: now
            }
          }
        });

        return {
          id: brand.id,
          name: brand.brandName,
          category: brand.category,
          visits: visitCount
        };
      })
    );

    // Get total visits for this executive in the period
    const totalVisits = await prisma.visit.count({
      where: {
        executiveId: executive.id,
        createdAt: {
          gte: startDate,
          lte: now
        }
      }
    });

    // Get assigned tasks counts
    const pendingTasks = await prisma.assigned.count({
      where: {
        executiveId: executive.id,
        status: {
          in: ['Assigned', 'In_Progress']
        }
      }
    });

    const completedTasks = await prisma.assigned.count({
      where: {
        executiveId: executive.id,
        status: 'Completed'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        brandVisits: brandVisitCounts,
        totalVisits: totalVisits,
        tasks: {
          pending: pendingTasks,
          completed: completedTasks,
          total: pendingTasks + completedTasks
        },
        period: period
      }
    });

  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
