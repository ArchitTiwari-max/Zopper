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
    let endDate: Date;

    switch (dateFilter) {
      case 'Today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // For 'Today', include the entire day until 23:59:59
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        endDate.setMilliseconds(-1); // Set to 23:59:59.999
        break;
      case 'Yesterday':
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        startDate = yesterday;
        // For 'Yesterday', include the entire day until 23:59:59
        endDate = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        break;
      case 'Last 7 Days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
        break;
      case 'Last 90 Days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
        break;
      case 'Last Year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
        break;
      case 'Last 30 Days':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Add 1 day buffer for timezone issues
    }

    // Build where clause for visits
    let whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
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
          reviewedAt: true,
          reviewedByAdmin: { select: { id: true, name: true } },
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

      // Generate consistent avatar color based on first letter of name
      const colors = [
        '#E53E3E', // A - Red
        '#DD6B20', // B - Orange  
        '#D69E2E', // C - Yellow
        '#38A169', // D - Green
        '#00A3C4', // E - Teal
        '#3182CE', // F - Blue
        '#553C9A', // G - Purple
        '#805AD5', // H - Violet
        '#D53F8C', // I - Pink
        '#F56500', // J - Dark Orange
        '#319795', // K - Dark Teal
        '#2D3748', // L - Dark Gray
        '#744210', // M - Brown
        '#065F46', // N - Dark Green
        '#1A365D', // O - Dark Blue
        '#44337A', // P - Dark Purple
        '#97266D', // Q - Dark Pink
        '#C53030', // R - Dark Red
        '#B7791F', // S - Golden
        '#2F855A', // T - Forest Green
        '#2B6CB0', // U - Steel Blue
        '#6B46C1', // V - Royal Purple
        '#BE185D', // W - Magenta
        '#DC2626', // X - Crimson
        '#059669', // Y - Emerald
        '#7C3AED'  // Z - Indigo
      ];
      const firstLetter = visit.executive.name.charAt(0).toUpperCase();
      const colorIndex = firstLetter.charCodeAt(0) - 65; // Convert A-Z to 0-25
      const safeColorIndex = Math.max(0, Math.min(colorIndex, colors.length - 1)); // Ensure valid index

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
        avatarColor: colors[safeColorIndex],
        storeName: visit.store.storeName,
        storeId: visit.store.id, // Add store ID for linking
        partnerBrand: partnerBrands,
        visitDate: formattedVisitDate,
        visitStatus: visit.status as 'PENDING_REVIEW' | 'REVIEWD',
        reviewerName: visit.reviewedByAdmin?.name,
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
