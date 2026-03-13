import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Haversine formula: fallback if Google Maps fails
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function getGoogleMapsDistances(
    origin: { lat: number; lng: number },
    destinations: Array<{ id: string; lat: number; lng: number }>
): Promise<Map<string, number>> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        throw new Error('Google Maps API key not configured');
    }

    const distanceMap = new Map<string, number>();

    // Chunk destinations into groups of 25 (safe limit for distance matrix API elements per request)
    const chunkSize = 25;
    for (let i = 0; i < destinations.length; i += chunkSize) {
        const chunk = destinations.slice(i, i + chunkSize);
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = chunk.map(d => `${d.lat},${d.lng}`).join('|');

        try {
            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${apiKey}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.status === 'OK' && data.rows && data.rows[0]) {
                const elements = data.rows[0].elements;
                chunk.forEach((dest, index) => {
                    const element = elements[index];
                    if (element.status === 'OK' && element.distance) {
                        // distance.value is in meters, convert to km
                        distanceMap.set(dest.id, element.distance.value / 1000);
                    } else {
                        // Fallback to haversine if route not found
                        distanceMap.set(dest.id, haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng));
                    }
                });
            } else {
                // Fallback for chunk
                chunk.forEach(dest => {
                    distanceMap.set(dest.id, haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng));
                });
            }
        } catch (err) {
            console.error('Google Maps API error:', err);
            // Fallback for chunk
            chunk.forEach(dest => {
                distanceMap.set(dest.id, haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng));
            });
        }
    }

    return distanceMap;
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const startStoreId = searchParams.get('startStoreId');

        if (!startStoreId) {
            return NextResponse.json({ error: 'startStoreId is required' }, { status: 400 });
        }

        // Get executive
        const executive = await prisma.executive.findUnique({
            where: { userId: user.userId },
            include: {
                executiveStores: { select: { storeId: true } }
            }
        });

        if (!executive) return NextResponse.json({ error: 'Executive not found' }, { status: 404 });

        const assignedStoreIds = executive.executiveStores.map(es => es.storeId);

        // Validate that startStoreId is in assigned stores
        if (!assignedStoreIds.includes(startStoreId)) {
            return NextResponse.json({ error: 'Start store not in assigned territory' }, { status: 400 });
        }

        // Fetch all assigned stores with coordinates
        const allStores = await prisma.store.findMany({
            where: { id: { in: assignedStoreIds } }
        });

        // Find start store
        const startStore = allStores.find(s => s.id === startStoreId);
        if (!startStore) return NextResponse.json({ error: 'Start store not found' }, { status: 404 });
        if (startStore.latitude == null || startStore.longitude == null) {
            return NextResponse.json({ error: 'Start store has no coordinates' }, { status: 400 });
        }

        // Sort all other assigned stores by driving distance from the starting store (ascending), top 10
        const destinationStores = allStores
            .filter(s => s.id !== startStoreId && s.latitude != null && s.longitude != null)
            .map(s => ({ id: s.id, lat: s.latitude!, lng: s.longitude! }));

        let drivingDistances = new Map<string, number>();
        try {
            drivingDistances = await getGoogleMapsDistances(
                { lat: startStore.latitude!, lng: startStore.longitude! },
                destinationStores
            );
        } catch (err) {
            console.warn('Failed to fetch Google Maps distances, falling back to Haversine', err);
            destinationStores.forEach(s => {
                drivingDistances.set(s.id, haversineDistance(startStore.latitude!, startStore.longitude!, s.lat, s.lng));
            });
        }

        const routeOrder = destinationStores
            .map(s => ({
                id: s.id,
                latitude: s.lat,
                longitude: s.lng,
                distanceFromStart: Math.round((drivingDistances.get(s.id) || 0) * 10) / 10
            }))
            .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
            .slice(0, 10);

        // Fetch last visit for each route store + start store (for history)
        const allRouteIds = [startStoreId, ...routeOrder.map(r => r.id)];

        const [visitsRaw, lastVisitPlan, allBrands] = await Promise.all([
            prisma.visit.findMany({
                where: { executiveId: executive.id, storeId: { in: allRouteIds } },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.visitPlan.findFirst({
                where: { executiveId: executive.id },
                orderBy: { submittedAt: 'desc' }
            }),
            prisma.brand.findMany({ select: { id: true, brandName: true } })
        ]);

        // Group last visit per store
        const lastVisitByStore = new Map<string, typeof visitsRaw[0]>();
        for (const visit of visitsRaw) {
            if (!lastVisitByStore.has(visit.storeId)) {
                lastVisitByStore.set(visit.storeId, visit);
            }
        }

        const lastPJPStoreIds = new Set<string>(lastVisitPlan?.storeIds ?? []);
        const brandMap = new Map(allBrands.map(b => [b.id, b.brandName]));
        const storeMap = new Map(allStores.map(s => [s.id, s]));

        // Helper: format visited text
        const formatVisited = (date: Date | null): string => {
            if (!date) return 'No visit';
            const now = new Date();
            const diffDays = Math.floor(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return '1 day ago';
            return `${diffDays} days ago`;
        };

        const buildStorePayload = (storeId: string, distanceFromStart: number) => {
            const store = storeMap.get(storeId);
            if (!store) return null;
            const lastVisit = lastVisitByStore.get(storeId) ?? null;
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
                distanceFromStart,  // distance from the selected starting store
                lastVisitDate: lastVisit?.createdAt ?? null,
                visited: formatVisited(lastVisit?.createdAt ?? null),
                wasInLastPJP: lastPJPStoreIds.has(storeId),
                lastPJPDate: lastVisitPlan?.submittedAt ?? null,
                lastVisit: lastVisit
                    ? {
                        personMet: lastVisit.personMet,
                        remarks: lastVisit.remarks,
                        imageUrls: lastVisit.imageUrls,
                        visitDate: lastVisit.visitDate ?? lastVisit.createdAt,
                        POSMchecked: lastVisit.POSMchecked
                    }
                    : null
            };
        };

        // Build start store payload (distance = 0)
        const startPayload = buildStorePayload(startStoreId, 0);

        // Build route payloads — already sorted by distanceFromStart ascending
        const routePayloads = routeOrder
            .map(r => buildStorePayload(r.id, r.distanceFromStart))
            .filter(Boolean);

        return NextResponse.json({
            success: true,
            data: {
                startStore: startPayload,
                route: routePayloads
            }
        });
    } catch (error) {
        console.error('Error in suggest-pjp:', error);
        return NextResponse.json({ error: 'Failed to suggest PJP' }, { status: 500 });
    }
}
