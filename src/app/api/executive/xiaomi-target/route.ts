import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Xiaomi brand ID (hardcoded to avoid extra DB round-trip)
const XIAOMI_BRAND_ID = 'brand_006';
const INVALID_NAMES = new Set(['blank', 'n/a', 'na', 'null', 'undefined', '-', '', 'grand total', 'total']);

// GET /api/executive/xiaomi-target
// Returns all Xiaomi stores with their July 2026 target revenue
// No executive assignment needed - visible to all executives
export async function GET(request: NextRequest) {
  try {
    const user = JSON.parse(request.headers.get('x-user-data') || 'null');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all Xiaomi target stores with their target data
    // storeCategory filter pushed to DB level to reduce data transfer
    const storeTargets = await prisma.storeTarget.findMany({
      where: {
        brandId: XIAOMI_BRAND_ID,
        month: 7,
        year: 2026,
        store: {
          storeCategory: 'XIAOMI_TARGET',
        }
      },
      select: {
        targetRevenue: true,
        store: {
          select: {
            id: true,
            storeName: true,
            state: true,
            fullAddress: true,
          }
        }
      },
      orderBy: {
        targetRevenue: 'desc'
      }
    });

    const targets = storeTargets
      .filter(t => {
        const name = (t.store.storeName || '').trim().toLowerCase();
        return name.length > 0 && !INVALID_NAMES.has(name);
      })
      .map(t => ({
        storeId: t.store.id,
        storeName: t.store.storeName,
        state: t.store.state,
        distributorName: t.store.fullAddress,
        targetRevenue: t.targetRevenue ?? 0,
      }));

    const totalTarget = targets.reduce((sum, t) => sum + t.targetRevenue, 0);

    return NextResponse.json({
      success: true,
      data: {
        targets,
        summary: {
          total: targets.length,
          totalTarget: Math.round(totalTarget * 100) / 100,
          month: 7,
          year: 2026,
        }
      }
    });

  } catch (error) {
    console.error('Error fetching Xiaomi targets:', error);
    return NextResponse.json({ error: 'Failed to fetch Xiaomi targets' }, { status: 500 });
  }
}
