import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const prisma = new PrismaClient();

    // Fetch all brands to populate template with real brand IDs and names
    const brands = await prisma.brand.findMany({
      select: { id: true, brandName: true },
      orderBy: { brandName: 'asc' }
    });

    await prisma.$disconnect();

    // Build sample brand data for the template (use first brand as example)
    const sampleBrandId = brands.length > 0 ? brands[0].id : 'brand_001';
    const sampleBrandName = brands.length > 0 ? brands[0].brandName : 'Godrej';

    // Template sample row with all required columns
    const templateData = [
      {
        Store_ID: 'STORE_001',
        'Store Name': 'Example Store Name',
        City: 'Mumbai',
        'Full Address': 'Plot No. 1, Example Street, Mumbai, MH',
        Latitude: 19.0760,
        Longitude: 72.8777,
        partneraBrandIds: sampleBrandId,
        partnerBrandNames: sampleBrandName,   // Read-only reference column (not used during import)
        storeBrandIds: 'SB-001',              // Comma-separated StoreBrand IDs corresponding to partneraBrandIds
        partnerBrandTypes: 'A+',
        'Store Category': 'LFR',
        'Store Channel': 'Offline',
        'City Tier': 'Tier 1',
        State: 'Maharashtra',
        Priority: 'p1',
        Executive_IDs: 'executive_001, executive_002',
        "POC's Name": 'John Doe, Jane Smith'  // Read-only reference column (not used during import)
      }
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Store_ID
      { wch: 35 }, // Store Name
      { wch: 20 }, // City
      { wch: 40 }, // Full Address
      { wch: 15 }, // Latitude
      { wch: 15 }, // Longitude
      { wch: 22 }, // partneraBrandIds
      { wch: 25 }, // partnerBrandNames
      { wch: 25 }, // storeBrandIds
      { wch: 20 }, // partnerBrandTypes
      { wch: 15 }, // Store Category
      { wch: 15 }, // Store Channel
      { wch: 15 }, // City Tier
      { wch: 15 }, // State
      { wch: 10 }, // Priority
      { wch: 35 }, // Executive_IDs
      { wch: 35 }, // POC's Name
    ];

    // Add a second sheet with brand reference data so user knows valid brand IDs
    const brandRefData = brands.map(b => ({
      'Brand ID': b.id,
      'Brand Name': b.brandName,
    }));
    const wsBrands = XLSX.utils.json_to_sheet(brandRefData);
    wsBrands['!cols'] = [{ wch: 20 }, { wch: 25 }];

    // Build workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Store Import Template');
    XLSX.utils.book_append_sheet(wb, wsBrands, 'Brand Reference');

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="store-import-template-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Store template generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate store template' },
      { status: 500 }
    );
  }
}
