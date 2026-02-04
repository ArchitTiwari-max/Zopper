import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const secNameSearch = searchParams.get('secName') || '';
        const executiveId = searchParams.get('executiveId');
        const storeId = searchParams.get('storeId');
        const type = searchParams.get('type');

        const queryInfo: any = {
            where: {},
            include: {
                user: {
                    include: {
                        executive: true, // properties like name are here
                        admin: true
                    }
                }
                // we can't include store as it's not a relation
            },
            orderBy: {
                submittedAt: 'desc'
            }
        };

        if (secNameSearch) {
            queryInfo.where.executiveName = {
                contains: secNameSearch,
                mode: 'insensitive' // MongoDB might not support mode: insensitive with string contains in all versions but Prisma usually handles it or regex
            };
        }

        if (executiveId && executiveId !== 'all') {
            queryInfo.where.userId = executiveId;
        }

        if (storeId && storeId !== 'all') {
            queryInfo.where.storeId = storeId;
        }

        // Remove Prisma-level type filtering to standardise behavior and avoid OR/NOT issues with legacy data
        // We will filter in memory below

        console.log('Querying Holiday Requests with:', JSON.stringify(queryInfo, null, 2));

        let requests = await prisma.holidayRequest.findMany(queryInfo);
        console.log(`Found ${requests.length} total holiday requests before type filtering`);

        if (type && type !== 'ALL') {
            if (type === 'VACATION') {
                requests = requests.filter((r: any) => r.type === 'VACATION' || !r.type);
            } else {
                requests = requests.filter((r: any) => r.type === type);
            }
        }
        console.log(`After filtering for ${type}, returning ${requests.length} requests`);
        console.log(`Found ${requests.length} holiday requests`);

        // Manually fetch stores for the requests
        const storeIds = Array.from(new Set(requests.map((r: any) => r.storeId).filter(Boolean)));
        const stores = await prisma.store.findMany({
            where: {
                id: { in: storeIds as string[] }
            },
            select: {
                id: true,
                storeName: true
            }
        });

        const storeMap = new Map(stores.map(s => [s.id, s.storeName]));

        const formattedRequests = requests.map((req: any) => ({
            id: req.id,
            secDetails: req.executiveName, // This contains "Name (Phone)"
            submittedBy: req.user.executive?.name || req.user.username || 'Unknown',
            reason: req.reason,
            startDate: req.startDate,
            endDate: req.endDate,
            storeName: req.storeId ? storeMap.get(req.storeId) || 'Unknown Store' : 'N/A',
            storeId: req.storeId,
            submittedAt: req.submittedAt,
            type: req.type || 'VACATION'
        }));

        return NextResponse.json({ data: formattedRequests });

    } catch (error) {
        console.error('Error fetching holiday requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
