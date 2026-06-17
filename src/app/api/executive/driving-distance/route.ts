import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface Leg {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const legs: Leg[] = body.legs;

        if (!Array.isArray(legs) || legs.length === 0) {
            return NextResponse.json({ error: 'legs array is required' }, { status: 400 });
        }

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
        }

        // Fetch distance for each leg in parallel to avoid N x N matrix size scaling issues and 100-element Google API limits
        const distances = await Promise.all(
            legs.map(async (leg) => {
                try {
                    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${leg.originLat},${leg.originLng}&destinations=${leg.destLat},${leg.destLng}&key=${apiKey}`;
                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]) {
                        const element = data.rows[0].elements[0];
                        if (element.status === 'OK' && element.distance) {
                            return Math.round((element.distance.value / 1000) * 10) / 10;
                        }
                    }
                    return null;
                } catch (e) {
                    console.error('Error fetching driving distance for leg:', leg, e);
                    return null;
                }
            })
        );

        return NextResponse.json({ success: true, distances });
    } catch (error) {
        console.error('Error in driving-distance proxy:', error);
        return NextResponse.json({ error: 'Failed to fetch driving distances' }, { status: 500 });
    }
}
