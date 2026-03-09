import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Haversine formula — straight-line distance between two lat/lng points (in km).
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns date range for a given dateFilter string.
 */
function getDateRange(dateFilter: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    switch (dateFilter) {
        case 'Today':
            break;
        case 'Yesterday':
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            break;
        case 'Last 7 Days':
            start.setDate(start.getDate() - 7);
            break;
        case 'Last 30 Days':
            start.setDate(start.getDate() - 30);
            break;
        case 'Last 90 Days':
            start.setDate(start.getDate() - 90);
            break;
        case 'Last Year':
            start.setFullYear(start.getFullYear() - 1);
            break;
        default:
            // default: Last 30 Days so data is visible
            start.setDate(start.getDate() - 30);
    }

    return { start, end };
}

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const dateFilter = searchParams.get('dateFilter') || 'week';
        const executiveFilter = searchParams.get('executiveId') || null;

        const { start, end } = getDateRange(dateFilter);

        // Fetch visits with store lat/lng and executive info
        const visits = await prisma.visit.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                ...(executiveFilter ? { executiveId: executiveFilter } : {}),
            },
            include: {
                store: {
                    select: {
                        id: true,
                        storeName: true,
                        city: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                executive: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Group: executiveId → dateKey → visits[]
        const grouped: Record<string, Record<string, typeof visits>> = {};

        for (const visit of visits) {
            const exId = visit.executiveId;
            // Convert createdAt to dd/mm/yyyy in IST
            const d = new Date(visit.createdAt);
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(d.getTime() + istOffset);
            const day = String(istDate.getUTCDate()).padStart(2, '0');
            const mon = String(istDate.getUTCMonth() + 1).padStart(2, '0');
            const yr = istDate.getUTCFullYear();
            const dateKey = `${yr}-${mon}-${day}`; // sortable
            const dateLabel = `${day}/${mon}/${yr}`;

            if (!grouped[exId]) grouped[exId] = {};
            if (!grouped[exId][dateKey]) grouped[exId][dateKey] = [];
            // attach label for response
            (visit as any)._dateLabel = dateLabel;
            grouped[exId][dateKey].push(visit);
        }

        // Build response
        const result = Object.entries(grouped).map(([exId, dayMap]) => {
            const firstVisit = Object.values(dayMap)[0][0];
            const executiveName = firstVisit.executive?.name || 'Unknown';

            const journeys = Object.entries(dayMap)
                .sort(([a], [b]) => b.localeCompare(a)) // newest date first
                .map(([_dateKey, dayVisits]) => {
                    const dateLabel = (dayVisits[0] as any)._dateLabel;

                    let totalDistanceKm = 0;
                    const storeStops = dayVisits.map((visit, idx) => {
                        const store = visit.store;
                        let distanceFromPrev = 0;
                        let hasCoordsError = false;

                        if (idx === 0) {
                            distanceFromPrev = 0;
                        } else {
                            const prev = dayVisits[idx - 1].store;
                            if (
                                prev.latitude != null && prev.longitude != null &&
                                store.latitude != null && store.longitude != null
                            ) {
                                distanceFromPrev = parseFloat(
                                    haversineKm(prev.latitude, prev.longitude, store.latitude, store.longitude).toFixed(2)
                                );
                                totalDistanceKm += distanceFromPrev;
                            } else {
                                hasCoordsError = true;
                            }
                        }

                        return {
                            visitId: visit.id,
                            storeName: store.storeName,
                            storeId: store.id,
                            city: store.city,
                            lat: store.latitude,
                            lng: store.longitude,
                            distanceFromPrev,          // km from previous stop (0 for first)
                            hasCoordsError,            // true if lat/lng missing for this or prev store
                            visitTime: visit.createdAt,
                        };
                    });

                    return {
                        date: dateLabel,
                        totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
                        storeCount: storeStops.length,
                        stores: storeStops,
                    };
                });

            return {
                executiveId: exId,
                executiveName,
                totalJourneyDays: journeys.length,
                journeys,
            };
        });

        // Sort executives by name
        result.sort((a, b) => a.executiveName.localeCompare(b.executiveName));

        return NextResponse.json({ trackers: result, dateFilter, periodStart: start, periodEnd: end });

    } catch (error) {
        console.error('[distance-tracker] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch distance tracker data' }, { status: 500 });
    }
}
