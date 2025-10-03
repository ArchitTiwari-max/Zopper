import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from '@/lib/auth';
import { generateUniqueIssueId } from '@/lib/issueIdGenerator';

const prisma = new PrismaClient();

// GET: last 5 digital visits for a store
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    if (!storeId) return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });

    const currentExecutive = await prisma.executive.findUnique({ where: { userId: user.userId } });
    if (!currentExecutive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const visits = await prisma.digitalVisit.findMany({
      where: { storeId },
      include: {
        issues: true,
        store: true,
        executive: { include: { user: true } },
        reviewedByAdmin: true,
      },
      orderBy: { connectDate: 'desc' },
      take: 5,
    });

    const transformed = visits.map(v => ({
      id: v.id,
      date: v.connectDate,
      status: v.status,
      representative: v.executive?.name || 'Unknown Executive',
      canViewDetails: v.executiveId === currentExecutive.id,
      personMet: v.personMet as any,
      remarks: v.remarks,
      adminComment: v.adminComment || null,
      storeName: v.store?.storeName || 'Unknown Store',
      issues: v.issues?.map(i => ({ id: i.id, details: i.details, status: i.status, createdAt: i.createdAt })) || [],
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    return NextResponse.json({ success: true, data: transformed });
  } catch (e) {
    console.error('Error fetching digital visits:', e);
    return NextResponse.json({ error: 'Failed to fetch digital visits' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST: create a new digital visit
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'EXECUTIVE') return NextResponse.json({ error: 'Access denied. Executive role required.' }, { status: 403 });

    const executive = await prisma.executive.findUnique({ where: { userId: user.userId } });
    if (!executive) return NextResponse.json({ error: 'Executive profile not found' }, { status: 404 });

    const { storeId, visitDate, connectDate, personMet, remarks, issuesRaised } = await request.json();

    const dateStr: string | undefined = connectDate || visitDate; // backward compat

    if (!storeId || !dateStr) return NextResponse.json({ error: 'storeId and connectDate are required' }, { status: 400 });
    if (!personMet || !Array.isArray(personMet) || personMet.length === 0) return NextResponse.json({ error: 'At least one person spoken is required' }, { status: 400 });
    if (!remarks || String(remarks).trim() === '') return NextResponse.json({ error: 'Remarks are required' }, { status: 400 });

    // Validate store assignment
    const assignment = await prisma.executiveStoreAssignment.findUnique({
      where: { executiveId_storeId: { executiveId: executive.id, storeId } },
    });
    if (!assignment) return NextResponse.json({ error: 'Access denied: You are not assigned to this store', code: 'STORE_NOT_ASSIGNED' }, { status: 403 });

    // Convert connect date
    const connectDateObj = new Date(`${dateStr}T00:00:00.000Z`);
    if (isNaN(connectDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid connect date' }, { status: 400 });
    }

    const digitalVisit = await prisma.digitalVisit.create({
      data: {
        connectDate: connectDateObj,
        personMet: personMet,
        remarks: String(remarks).trim(),
        status: 'PENDING_REVIEW' as any,
        executiveId: executive.id,
        storeId,
      },
    });

    let createdIssues: any[] = [];
    if (issuesRaised && Array.isArray(issuesRaised) && issuesRaised.length > 0) {
      for (const details of issuesRaised) {
        if (details && String(details).trim() !== '') {
          // Generate a 7-character unique ID to match Issue schema expectations
          const uniqueIssueId = await generateUniqueIssueId();
          const created = await prisma.issue.create({
            data: { 
              id: uniqueIssueId,
              details: String(details).trim(), 
              digitalVisitId: digitalVisit.id,
              createdAt: connectDateObj // align issue date with connect date
            },
          });
          createdIssues.push({ id: created.id, details: created.details, status: created.status });
        }
      }
    }

    return NextResponse.json({ success: true, data: { digitalVisit: { id: digitalVisit.id, status: digitalVisit.status, connectDate: digitalVisit.connectDate }, issues: createdIssues } });
  } catch (e) {
    console.error('Error creating digital visit:', e);
    return NextResponse.json({ error: 'Failed to create digital visit' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
