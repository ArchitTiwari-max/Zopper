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

        // Build origins and destinations — one per leg
        // Distance Matrix returns a matrix; we take element[i][i] (diagonal) for each leg pair
        const originsStr = legs.map(l => `${l.originLat},${l.originLng}`).join('|');
        const destsStr = legs.map(l => `${l.destLat},${l.destLng}`).join('|');

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destsStr}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== 'OK' || !data.rows) {
            return NextResponse.json(
                { error: `Google Maps API error: ${data.status}` },
                { status: 502 }
            );
        }

        // Extract diagonal: row[i] → element[i] is origin[i] → destination[i]
        const distances: (number | null)[] = legs.map((_, i) => {
            const element = data.rows[i]?.elements[i];
            if (element?.status === 'OK' && element.distance) {
                return Math.round((element.distance.value / 1000) * 10) / 10;
            }
            return null;
        });

        return NextResponse.json({ success: true, distances });
    } catch (error) {
        console.error('Error in driving-distance proxy:', error);
        return NextResponse.json({ error: 'Failed to fetch driving distances' }, { status: 500 });
    }
}
