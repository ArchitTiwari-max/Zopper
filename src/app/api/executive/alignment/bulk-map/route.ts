import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'EXECUTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetStoreIds, roleName, person } = await request.json();

    if (!targetStoreIds || !Array.isArray(targetStoreIds) || targetStoreIds.length === 0) {
      return NextResponse.json({ error: 'Target stores are required' }, { status: 400 });
    }

    if (!roleName || !person || !person.name || !person.phone) {
      return NextResponse.json({ error: 'Role and valid person details are required' }, { status: 400 });
    }

    // Process each target store one by one perfectly
    for (const storeId of targetStoreIds) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { alignment: true }
      });

      if (!store) continue;

      let alignment = store.alignment;

      // If no alignment exists at all, initialize it based on store type
      if (!alignment) {
        const isCroma = store.storeName.toUpperCase().includes('CROMA');
        const storeLevel = isCroma 
          ? ['SEC', 'ADM', 'Store Manager', 'Cluster Manager'].map(r => ({ role: r, personnel: [] }))
          : ['SEC', 'TL', 'Store Manager', 'Category Manager'].map(r => ({ role: r, personnel: [] }));
          
        const stakeholderLevel = ['ABM', 'ASE', 'ZSE', 'ZSM', 'KAM'].map(r => ({ role: r, personnel: [] }));

        alignment = await prisma.storeAlignment.create({
          data: {
            storeId,
            storeLevel,
            stakeholderLevel,
            updatedBy: user.userId
          }
        });
      }

      // Now we have an alignment. Find the role in stakeholderLevel
      const stakeholderLevel = (alignment.stakeholderLevel as any[]) || [];
      const roleObj = stakeholderLevel.find(r => r.role === roleName);

      if (roleObj) {
        // Check if person is already mapped to avoid duplicates based on exact phone number
        const exists = roleObj.personnel.some((p: any) => p.phone === person.phone);
        if (!exists) {
          roleObj.personnel.push({ name: person.name, phone: person.phone });
        }
      } else {
        // Just in case the role wasn't there at all, add it
        stakeholderLevel.push({
          role: roleName,
          personnel: [{ name: person.name, phone: person.phone }]
        });
      }

      // Save the updated alignment
      await prisma.storeAlignment.update({
        where: { id: alignment.id },
        data: {
          stakeholderLevel,
          updatedBy: user.userId
        }
      });
    }

    return NextResponse.json({ success: true, count: targetStoreIds.length });

  } catch (error) {
    console.error('Error in bulk map:', error);
    return NextResponse.json({ error: 'Failed to bulk-map personnel' }, { status: 500 });
  }
}
