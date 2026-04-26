import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * PATCH: Update roles/weights or toggle store exclusion for a chain config
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chainName, storeRoles, stakeholderRoles, excludedStoreIds } = body;

    // Validate weight sums if roles are being updated
    if (storeRoles !== undefined || stakeholderRoles !== undefined) {
      const allRoles = [
        ...(storeRoles || []),
        ...(stakeholderRoles || []),
      ];
      const totalWeight = allRoles.reduce((sum: number, r: any) => sum + (Number(r.weight) || 0), 0);

      if (allRoles.length > 0 && totalWeight !== 100) {
        return NextResponse.json(
          {
            error: `Total weight must equal exactly 100%. Current total: ${totalWeight}%`,
            currentTotal: totalWeight,
          },
          { status: 422 }
        );
      }
    }

    const updateData: any = {};
    if (chainName !== undefined) updateData.chainName = chainName.toUpperCase();
    if (storeRoles !== undefined) updateData.storeRoles = storeRoles;
    if (stakeholderRoles !== undefined) updateData.stakeholderRoles = stakeholderRoles;
    if (excludedStoreIds !== undefined) updateData.excludedStoreIds = excludedStoreIds;

    const updated = await prisma.storeChainConfig.update({
      where: { id: params.chainId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Chain config not found' }, { status: 404 });
    }
    console.error('Error updating chain config:', error);
    return NextResponse.json({ error: 'Failed to update chain config' }, { status: 500 });
  }
}

/**
 * DELETE: Remove a chain config entirely
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.storeChainConfig.delete({
      where: { id: params.chainId }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Chain config not found' }, { status: 404 });
    }
    console.error('Error deleting chain config:', error);
    return NextResponse.json({ error: 'Failed to delete chain config' }, { status: 500 });
  }
}
