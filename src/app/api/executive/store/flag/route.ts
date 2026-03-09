import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        // Get authenticated user from token
        const user = await getAuthenticatedUser(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is an executive
        if (user.role !== 'EXECUTIVE') {
            return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });
        }

        const { storeId, isFlagged } = await request.json();

        if (!storeId || typeof isFlagged !== 'boolean') {
            return NextResponse.json({ error: 'Store ID and isFlagged boolean are required' }, { status: 400 });
        }

        // Get executive data
        const executive = await prisma.executive.findUnique({
            where: { userId: user.userId },
            select: { id: true }
        });

        if (!executive) {
            return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });
        }

        // Update the ExecutiveStoreAssignment
        // We search by composite key if possible, but prisma doesn't support update on non-unique fields directly unless we have an ID or unique constraint.
        // We have @@unique([executiveId, storeId]) in schema, so we can use that.

        const updatedAssignment = await prisma.executiveStoreAssignment.update({
            where: {
                executiveId_storeId: {
                    executiveId: executive.id,
                    storeId: storeId
                }
            },
            data: {
                isFlagged: isFlagged
            }
        });

        return NextResponse.json({
            success: true,
            data: updatedAssignment
        });

    } catch (error) {
        console.error('Error updating store flag:', error);
        return NextResponse.json(
            { error: 'Failed to update store flag' },
            { status: 500 }
        );
    }
}
