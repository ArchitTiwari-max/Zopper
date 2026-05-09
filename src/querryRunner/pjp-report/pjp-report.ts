import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function generatePJPReport() {
  try {
    console.log('📊 Generating PJP Report for last 30 days...');

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    console.log(`📅 Date Range: ${thirtyDaysAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);

    // Fetch all executives
    const executives = await prisma.executive.findMany({
      select: {
        id: true,
        name: true,
        contact_number: true,
        region: true,
        user: {
          select: {
            email: true,
            username: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`👥 Found ${executives.length} executives`);

    // Fetch PJP data for each executive in the last 30 days
    const reportData = [];

    for (const executive of executives) {
      const visitPlans = await prisma.visitPlan.findMany({
        where: {
          executiveId: executive.id,
          submittedAt: {
            gte: thirtyDaysAgo,
            lte: today
          }
        },
        select: {
          id: true,
          submittedAt: true,
          plannedVisitDate: true,
          status: true,
          storeIds: true
        },
        orderBy: {
          submittedAt: 'desc'
        }
      });

      // Group by date to count PJPs per day
      const pjpByDate: { [key: string]: number } = {};
      
      visitPlans.forEach(plan => {
        const dateKey = plan.submittedAt.toISOString().split('T')[0];
        pjpByDate[dateKey] = (pjpByDate[dateKey] || 0) + 1;
      });

      // Calculate total PJPs
      const totalPJPs = visitPlans.length;

      // Calculate average stores per PJP
      const avgStoresPerPJP = totalPJPs > 0 
        ? (visitPlans.reduce((sum, plan) => sum + plan.storeIds.length, 0) / totalPJPs).toFixed(2)
        : '0';

      // Get last PJP date
      const lastPJPDate = visitPlans.length > 0 
        ? visitPlans[0].submittedAt.toISOString().split('T')[0]
        : 'N/A';

      reportData.push({
        'Executive ID': executive.id,
        'Executive Name': executive.name,
        'Email': executive.user.email,
        'Username': executive.user.username,
        'Contact Number': executive.contact_number || 'N/A',
        'Region': executive.region || 'N/A',
        'Total PJPs (Last 30 Days)': totalPJPs,
        'Average Stores per PJP': avgStoresPerPJP,
        'Last PJP Date': lastPJPDate,
        'PJP Details': JSON.stringify(pjpByDate)
      });
    }

    // Sort by total PJPs (descending)
    reportData.sort((a, b) => b['Total PJPs (Last 30 Days)'] - a['Total PJPs (Last 30 Days)']);

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(reportData);

    // Set column widths
    const columnWidths = [
      { wch: 25 }, // Executive ID
      { wch: 30 }, // Executive Name
      { wch: 35 }, // Email
      { wch: 20 }, // Username
      { wch: 15 }, // Contact Number
      { wch: 15 }, // Region
      { wch: 25 }, // Total PJPs
      { wch: 20 }, // Average Stores per PJP
      { wch: 15 }, // Last PJP Date
      { wch: 50 }  // PJP Details
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'PJP Report');

    // Create summary sheet
    const totalPJPsAll = reportData.reduce((sum, row) => sum + row['Total PJPs (Last 30 Days)'], 0);
    const activeExecutives = reportData.filter(row => row['Total PJPs (Last 30 Days)'] > 0).length;
    const inactiveExecutives = reportData.filter(row => row['Total PJPs (Last 30 Days)'] === 0).length;

    const summaryData = [
      { 'Metric': 'Report Period', 'Value': `Last 30 Days (${thirtyDaysAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]})` },
      { 'Metric': 'Total Executives', 'Value': executives.length },
      { 'Metric': 'Active Executives (Submitted PJP)', 'Value': activeExecutives },
      { 'Metric': 'Inactive Executives (No PJP)', 'Value': inactiveExecutives },
      { 'Metric': 'Total PJPs Submitted', 'Value': totalPJPsAll },
      { 'Metric': 'Average PJPs per Executive', 'Value': (totalPJPsAll / executives.length).toFixed(2) },
      { 'Metric': 'Report Generated On', 'Value': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `pjp-report-last-30-days-${timestamp}.xlsx`;

    // Write file
    XLSX.writeFile(workbook, filename);

    console.log(`✅ Excel file generated successfully: ${filename}`);
    console.log(`📊 Summary:`);
    console.log(`   - Total Executives: ${executives.length}`);
    console.log(`   - Active Executives: ${activeExecutives}`);
    console.log(`   - Inactive Executives: ${inactiveExecutives}`);
    console.log(`   - Total PJPs: ${totalPJPsAll}`);

  } catch (error) {
    console.error('❌ Error generating PJP report:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the report
generatePJPReport()
  .then(() => {
    console.log('🎉 PJP Report generation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
