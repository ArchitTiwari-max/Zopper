import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

// GET: Export all users to Excel
export async function GET(request: NextRequest) {
  try {
    console.log('Starting user export process...');
    
    // Fetch all users with complete information
    const users = await prisma.user.findMany({
      include: {
        admin: true,
        executive: {
          include: {
            _count: {
              select: {
                visits: true,
                assigned: true,
                visitPlans: true,
                executiveStores: true
              }
            }
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // ADMIN first, then EXECUTIVE
        { createdAt: 'desc' }
      ]
    });

    console.log(`Found ${users.length} users to export`);

    // Prepare data for Excel export
    const excelData = users.map((user, index) => {
      const isAdmin = user.role === 'ADMIN';
      const userInfo = user.admin || user.executive;
      
      return {
        'Sr No': index + 1,
        'User ID': user.id,
        'Username': user.username,
        'Email': user.email,
        'Role': user.role,
        'Admin ID': isAdmin ? user.admin?.id || 'N/A' : 'N/A',
        'Executive ID': !isAdmin ? user.executive?.id || 'N/A' : 'N/A',
        'Full Name': userInfo?.name || 'N/A',
        'Contact Number': userInfo?.contact_number || 'N/A',
        'Region': userInfo?.region || 'N/A',
        'Total Visits': !isAdmin ? user.executive?._count?.visits || 0 : 'N/A',
        'Total Assignments': !isAdmin ? user.executive?._count?.assigned || 0 : 'N/A',
        'Total Visit Plans': !isAdmin ? user.executive?._count?.visitPlans || 0 : 'N/A',
        'Store Assignments': !isAdmin ? user.executive?._count?.executiveStores || 0 : 'N/A',
        'Account Created': user.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        'Last Updated': user.updatedAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        'Account Status': 'Active'
      };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const columnWidths = [
      { wpx: 50 },   // Sr No
      { wpx: 120 },  // User ID
      { wpx: 100 },  // Username
      { wpx: 200 },  // Email
      { wpx: 80 },   // Role
      { wpx: 120 },  // Admin ID
      { wpx: 120 },  // Executive ID
      { wpx: 150 },  // Full Name
      { wpx: 120 },  // Contact Number
      { wpx: 100 },  // Region
      { wpx: 80 },   // Total Visits
      { wpx: 100 },  // Total Assignments
      { wpx: 100 },  // Total Visit Plans
      { wpx: 100 },  // Store Assignments
      { wpx: 140 },  // Account Created
      { wpx: 140 },  // Last Updated
      { wpx: 100 }   // Account Status
    ];
    
    worksheet['!cols'] = columnWidths;

    // Style the header row
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4F46E5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // Apply header styling
    const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1', 'M1', 'N1', 'O1', 'P1', 'Q1'];
    headerCells.forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = headerStyle;
      }
    });

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users Report');

    // Create additional summary sheet
    const summaryData = [
      { 'Metric': 'Total Users', 'Count': users.length },
      { 'Metric': 'Total Admins', 'Count': users.filter(u => u.role === 'ADMIN').length },
      { 'Metric': 'Total Executives', 'Count': users.filter(u => u.role === 'EXECUTIVE').length },
      { 'Metric': 'Users with Regions', 'Count': users.filter(u => (u.admin?.region || u.executive?.region)).length },
      { 'Metric': 'Users with Contact Info', 'Count': users.filter(u => (u.admin?.contact_number || u.executive?.contact_number)).length },
      { 'Metric': 'Export Generated On', 'Count': new Date().toLocaleString('en-US') }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wpx: 200 }, { wpx: 100 }];

    // Style summary sheet header
    ['A1', 'B1'].forEach(cell => {
      if (summarySheet[cell]) {
        summarySheet[cell].s = headerStyle;
      }
    });

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true
    });

    console.log('Excel file generated successfully');

    // Return the Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="users_report_${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error exporting users to Excel:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to export users to Excel' 
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}