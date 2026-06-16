import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date');

        if (!dateStr) {
            return NextResponse.json({ error: 'date is required' }, { status: 400 });
        }

        // Get executive
        const executive = await prisma.executive.findUnique({
            where: { userId: user.userId }
        });

        if (!executive) return NextResponse.json({ error: 'Executive not found' }, { status: 404 });

        const [year, month, day] = dateStr.split('-').map(Number);
        const startOfTargetDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfTargetDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const rescheduledVisits = await prisma.visit.findMany({
            where: {
                executiveId: executive.id,
                nextScheduledDate: {
                    gte: startOfTargetDay,
                    lte: endOfTargetDay
                }
            },
            include: {
                store: true
            }
        });

        // Fetch brands for name mapping
        const allBrands = await prisma.brand.findMany({ select: { id: true, brandName: true } });
        const brandMap = new Map(allBrands.map(b => [b.id, b.brandName]));

        // Fetch last visit plan to see if stores were in last PJP
        const lastVisitPlan = await prisma.visitPlan.findFirst({
            where: { executiveId: executive.id },
            orderBy: { submittedAt: 'desc' }
        });
        const lastPJPStoreIds = new Set<string>(lastVisitPlan?.storeIds ?? []);

        // Helper: format visited text
        const formatVisited = (date: Date | null): string => {
            if (!date) return 'No visit';
            const now = new Date();
            const diffDays = Math.floor(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return '1 day ago';
            return `${diffDays} days ago`;
        };

        const data = rescheduledVisits.map(v => {
            const store = v.store;
            const partnerBrands = store.partnerBrandIds.map(id => brandMap.get(id)).filter(Boolean);

            return {
                id: store.id,
                storeName: store.storeName,
                city: store.city,
                fullAddress: store.fullAddress,
                latitude: store.latitude,
                longitude: store.longitude,
                partnerBrands,
                partnerBrandTypes: (store as any).partnerBrandTypes ?? [],
                distanceFromStart: 0,
                lastVisitDate: v.createdAt,
                visited: formatVisited(v.createdAt),
                wasInLastPJP: lastPJPStoreIds.has(store.id),
                lastPJPDate: lastVisitPlan?.submittedAt ?? null,
                isRescheduled: true,
                lastVisit: {
                    personMet: v.personMet,
                    remarks: v.remarks,
                    imageUrls: v.imageUrls,
                    visitDate: v.visitDate ?? v.createdAt,
                    POSMchecked: v.POSMchecked
                }
            };
        });

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error in rescheduled-visits:', error);
        return NextResponse.json({ error: 'Failed to fetch rescheduled visits' }, { status: 500 });
    }
}
