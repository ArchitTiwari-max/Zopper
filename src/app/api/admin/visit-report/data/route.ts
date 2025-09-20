import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check if admin
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' }, 
        { status: 403 }
      );
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter') || 'Last 30 Days';
    const partnerBrand = searchParams.get('partnerBrand');
    const city = searchParams.get('city');
    const storeName = searchParams.get('storeName');
    const storeId = searchParams.get('storeId');
    const executiveName = searchParams.get('executiveName');
    const executiveId = searchParams.get('executiveId');
    const visitStatus = searchParams.get('visitStatus');
    const issueStatus = searchParams.get('issueStatus');

    // Calculate date range based on filter
    const now = new Date();
    let startDate: Date;

    switch (dateFilter) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'Last Year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build where clause for visits
    let whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: now
      }
    };

    // Add direct ID filters to the database query for better performance
    if (storeId) {
      whereClause.storeId = storeId;
    }

    if (executiveId) {
      whereClause.executiveId = executiveId;
    }

    // OPTIMIZED: Get visits and brands concurrently with Promise.all - no limits, fetch all data
    const [visits, brands] = await Promise.all([
      // Get ALL visits with related data - no limits
      prisma.visit.findMany({
        where: whereClause,
        select: {
          id: true,
          status: true,
          remarks: true,
          brandIds: true,
          createdAt: true,
          POSMchecked: true,
          personMet: true,
          imageUrls: true,
          executive: {
            select: {
              id: true,
              name: true
            }
          },
          store: {
            select: {
              id: true,
              storeName: true,
              city: true
            }
          },
          issues: {
            select: {
              id: true,
              details: true,
              status: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),

      // Get ALL brands for brand mapping - no limits
      prisma.brand.findMany({
        select: {
          id: true,
          brandName: true
        }
      })
    ]);
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Process visit data
    let processedVisits = visits.map((visit) => {
      // Get partner brands for this visit
      const partnerBrands = visit.brandIds
        .map(brandId => brandMap.get(brandId))
        .filter(Boolean) as string[];

      // Get executive initials
      const initials = visit.executive.name
        .split(' ')
        .map(word => word.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase();

      // Generate consistent avatar color
      const colors = [
        '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#10B981',
        '#EF4444', '#F59E0B', '#6366F1', '#84CC16', '#F43F5E'
      ];
      const colorIndex = visit.executive.name.length % colors.length;

      // Process personMet data - handle multiple people
      let peopleMet: Array<{name: string, designation: string, phoneNumber?: string}> = [];
      
      if (visit.personMet && Array.isArray(visit.personMet) && visit.personMet.length > 0) {
        peopleMet = visit.personMet.map((person: any) => ({
          name: person?.name || '',
          designation: person?.designation || '',
          phoneNumber: person?.phoneNumber
        })).filter(person => person.name); // Filter out empty entries
      }

      // Determine issue status
      let issueStatusResult: 'Pending' | 'Assigned' | 'Resolved' | null = null;
      let issues = 'None';
      let issueId: string | undefined;

      if (visit.issues.length > 0) {
        const issue = visit.issues[0]; // Take first issue
        issues = issue.details;
        issueId = issue.id; // Keep issue ID as string (ObjectId)
        issueStatusResult = issue.status as 'Pending' | 'Assigned' | 'Resolved';
      }

      // Format date to dd/mm/yyyy format
      const visitDate = new Date(visit.createdAt);
      const formattedVisitDate = `${visitDate.getDate().toString().padStart(2, '0')}/${(visitDate.getMonth() + 1).toString().padStart(2, '0')}/${visitDate.getFullYear()}`;

      return {
        id: visit.id, // Keep actual ObjectId for database operations
        executiveId: visit.executive.id,
        executiveName: visit.executive.name,
        executiveInitials: initials,
        avatarColor: colors[colorIndex],
        storeName: visit.store.storeName,
        storeId: visit.store.id, // Add store ID for linking
        partnerBrand: partnerBrands,
        visitDate: formattedVisitDate,
        visitStatus: visit.status as 'PENDING_REVIEW' | 'REVIEWD',
        issueStatus: issueStatusResult,
        city: visit.store.city,
        issues: issues,
        issueId: issueId,
        feedback: visit.remarks || 'No feedback provided',
        POSMchecked: visit.POSMchecked,
        peopleMet: peopleMet,
        imageUrls: visit.imageUrls || []
      };
    });

    // Apply additional filters (ID filters are already applied to the database query)
    // These filters operate on the processed data
    if (partnerBrand && partnerBrand !== 'All Brands') {
      processedVisits = processedVisits.filter(visit => 
        visit.partnerBrand.includes(partnerBrand)
      );
    }

    if (city && city !== 'All City') {
      processedVisits = processedVisits.filter(visit => visit.city === city);
    }

    // Only apply name-based filtering if no ID filtering was done
    if (storeName && storeName !== 'All Store' && !storeId) {
      processedVisits = processedVisits.filter(visit => 
        visit.storeName.toLowerCase().includes(storeName.toLowerCase())
      );
    }

    if (executiveName && executiveName !== 'All Executive' && !executiveId) {
      processedVisits = processedVisits.filter(visit => 
        visit.executiveName.toLowerCase().includes(executiveName.toLowerCase())
      );
    }

    if (visitStatus && visitStatus !== 'All Status') {
      processedVisits = processedVisits.filter(visit => 
        visit.visitStatus === visitStatus
      );
    }

    if (issueStatus && issueStatus !== 'All Status') {
      if (issueStatus === 'Pending') {
        // "Pending" filter includes both Pending and Assigned issues
        processedVisits = processedVisits.filter(visit => 
          visit.issueStatus === 'Pending' || visit.issueStatus === 'Assigned'
        );
      } else {
        // Other statuses (Resolved) filter exactly
        processedVisits = processedVisits.filter(visit => 
          visit.issueStatus === issueStatus
        );
      }
    }

    return NextResponse.json({
      visits: processedVisits,
      total: processedVisits.length
    });

  } catch (error) {
    console.error('Visit Report Data API Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
