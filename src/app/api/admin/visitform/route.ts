import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

// GET endpoint to fetch past admin visits for a store
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);

        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized. Admin role required.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        // Get last 5 visits for this store by ANY admin or executive
        const [adminVisitsRaw, executiveVisitsRaw] = await Promise.all([
            (prisma as any).adminVisit.findMany({
                where: { storeId: storeId },
                include: { store: true, admin: { include: { user: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5
            }),
            prisma.visit.findMany({
                where: { storeId: storeId },
                include: {
                    store: true,
                    executive: { include: { user: true } },
                    issues: {
                        include: {
                            assigned: {
                                include: {
                                    executive: {
                                        include: { user: true }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { visitDate: 'desc' },
                take: 5
            })
        ]);

        const allVisits = [
            ...adminVisitsRaw.map((v: any) => ({ ...v, submitterType: 'ADMIN' as const })),
            ...executiveVisitsRaw.map((v: any) => ({ ...v, submitterType: 'EXECUTIVE' as const }))
        ].sort((a, b) => {
            const aDate = (a as any).visitDate || a.createdAt;
            const bDate = (b as any).visitDate || b.createdAt;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
        }).slice(0, 5);

        const transformedVisits = allVisits.map(visit => {
            if (visit.submitterType === 'ADMIN') {
                return {
                    id: visit.id,
                    date: ((visit as any).visitDate || visit.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                    status: 'REVIEWD',
                    representative: (visit as any).admin?.name ? `${(visit as any).admin.name} (Admin)` : 'Unknown Admin',
                    canViewDetails: true,
                    personMet: visit.personMet,
                    POSMchecked: visit.POSMchecked,
                    remarks: visit.remarks,
                    imageUrls: visit.imageUrls,
                    adminComment: '',
                    storeName: visit.store?.storeName || 'Unknown Store',
                    issues: [],
                    createdAt: visit.createdAt,
                    updatedAt: visit.updatedAt
                };
            } else {
                return {
                    id: visit.id,
                    date: ((visit as any).visitDate || visit.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                    status: (visit as any).status,
                    representative: (visit as any).executive?.name || 'Unknown Executive',
                    canViewDetails: true, // Admins can view all executive details
                    personMet: visit.personMet,
                    POSMchecked: visit.POSMchecked,
                    remarks: visit.remarks,
                    imageUrls: visit.imageUrls,
                    adminComment: (visit as any).adminComment,
                    storeName: visit.store?.storeName || 'Unknown Store',
                    issues: ((visit as any).issues || []).map((issue: any) => ({
                        id: issue.id,
                        details: issue.details,
                        status: issue.status,
                        createdAt: issue.createdAt,
                        assigned: issue.assigned.map((assignment: any) => ({
                            id: assignment.id,
                            adminComment: assignment.adminComment,
                            status: assignment.status,
                            createdAt: assignment.createdAt,
                            executiveName: assignment.executive?.name || 'Unknown Executive'
                        }))
                    })),
                    createdAt: visit.createdAt,
                    updatedAt: visit.updatedAt
                };
            }
        });

        return NextResponse.json({
            success: true,
            data: transformedVisits
        });

    } catch (error) {
        console.error('Error fetching admin visits:', error);
        return NextResponse.json(
            { error: 'Failed to fetch admin visits' },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

// POST endpoint to create a new admin visit
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);

        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized. Admin role required.' }, { status: 401 });
        }

        const admin = await prisma.admin.findUnique({
            where: { userId: user.userId }
        });

        if (!admin) {
            return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });
        }

        const {
            storeId,
            visitDate,
            personMet,
            POSMchecked,
            brandsVisited,
            remarks,
            imageUrls
        } = await request.json();

        if (!storeId || !personMet || personMet.length === 0) {
            return NextResponse.json({
                error: 'Store ID and at least one person met are required'
            }, { status: 400 });
        }

        if (!visitDate) {
            return NextResponse.json({
                error: 'Visit date is required'
            }, { status: 400 });
        }

        const brandIds: string[] = [];
        if (brandsVisited && brandsVisited.length > 0) {
            const brands = await prisma.brand.findMany({
                where: {
                    brandName: {
                        in: brandsVisited
                    }
                }
            });
            brandIds.push(...brands.map(brand => brand.id));
        }

        const visitDateTime = new Date(visitDate + 'T00:00:00.000Z');

        const visit = await (prisma as any).adminVisit.create({
            data: {
                personMet: personMet,
                POSMchecked: POSMchecked,
                remarks: remarks || '',
                imageUrls: imageUrls || [],
                adminId: admin.id,
                storeId: storeId,
                brandIds: brandIds,
                visitDate: visitDateTime
            },
            include: {
                store: true,
                admin: true
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                visit: {
                    id: visit.id,
                    visitDate: visit.visitDate,
                    createdAt: visit.createdAt
                }
            }
        });

    } catch (error) {
        console.error('Error creating admin visit:', error);
        return NextResponse.json(
            { error: 'Failed to create admin visit' },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
