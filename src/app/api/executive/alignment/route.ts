import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getChainConfigForStore } from '@/lib/chainConfig';

export const runtime = 'nodejs';

/**
 * GET: Fetch alignment data for a store
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const alignment = await prisma.storeAlignment.findUnique({
      where: { storeId }
    });

    // Fetch the store name for chain config lookup
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { storeName: true }
    });

    let updatedByName = null;
    if (alignment?.updatedBy) {
      const executive = await prisma.executive.findUnique({
        where: { userId: alignment.updatedBy },
        select: { name: true }
      });
      if (executive) {
        updatedByName = executive.name;
      } else {
        const userRec = await prisma.user.findUnique({
          where: { id: alignment.updatedBy },
          select: { username: true }
        });
        updatedByName = userRec?.username || null;
      }
    }

    // Load chain config for this store (roles + weights)
    const chainConfig = store
      ? await getChainConfigForStore(storeId, store.storeName)
      : null;

    return NextResponse.json({
      success: true,
      data: alignment
        ? { ...alignment, updatedByName, chainConfig }
        : { chainConfig }  // No alignment yet, but still return chain config so UI knows which roles to show
    });

  } catch (error) {
    console.error('Error fetching alignment:', error);
    return NextResponse.json({ error: 'Failed to fetch alignment' }, { status: 500 });
  }
}

/**
 * POST: Create or Update alignment data
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { storeId, storeLevel, stakeholderLevel } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const existingAlignment = await prisma.storeAlignment.findUnique({
      where: { storeId }
    });

    let currentUserName = user.userId;
    const executive = await prisma.executive.findUnique({
      where: { userId: user.userId },
      select: { name: true }
    });
    if (executive) {
      currentUserName = executive.name;
    } else {
      const userRec = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { username: true }
      });
      currentUserName = userRec?.username || user.userId;
    }

    const mapUpdatedByName = (newLevel: any[], oldLevel: any[]) => {
      if (!newLevel || !Array.isArray(newLevel)) return newLevel;
      return newLevel.map((newRole: any) => {
        const oldRole = Array.isArray(oldLevel) ? oldLevel.find((r: any) => r.role === newRole.role) : null;
        
        const updatedPersonnel = (newRole.personnel || []).map((newP: any) => {
          let oldP = null;
          if (oldRole && Array.isArray(oldRole.personnel)) {
             oldP = oldRole.personnel.find((p: any) => p.name === newP.name && p.phone === newP.phone);
          }
          return {
            ...newP,
            updatedByName: oldP && oldP.updatedByName ? oldP.updatedByName : currentUserName
          };
        });

        return { ...newRole, personnel: updatedPersonnel };
      });
    };

    const finalStoreLevel = mapUpdatedByName(storeLevel, existingAlignment?.storeLevel as any[]);
    const finalStakeholderLevel = mapUpdatedByName(stakeholderLevel, existingAlignment?.stakeholderLevel as any[]);

    const updatedAlignment = await prisma.storeAlignment.upsert({
      where: { storeId },
      update: {
        storeLevel: finalStoreLevel,
        stakeholderLevel: finalStakeholderLevel,
        updatedBy: user.userId
      },
      create: {
        storeId,
        storeLevel: finalStoreLevel,
        stakeholderLevel: finalStakeholderLevel,
        updatedBy: user.userId
      }
    });

    // Fetch the store name for chain config lookup
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { storeName: true }
    });

    // Load the chain config for this store
    const chainConfig = store
      ? await getChainConfigForStore(storeId, store.storeName)
      : null;

    return NextResponse.json({
      success: true,
      data: { ...updatedAlignment, chainConfig }
    });

  } catch (error) {
    console.error('Error saving alignment:', error);
    return NextResponse.json({ error: 'Failed to save alignment' }, { status: 500 });
  }
}
