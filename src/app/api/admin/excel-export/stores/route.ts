import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const prisma = new PrismaClient();

    // Fetch all stores with their executives and visit counts
    const stores = await prisma.store.findMany({
      include: {
        executiveStores: {
          include: {
            executive: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: { visits: true }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });

    // Transform data to match template format
    const exportData = stores.map(store => ({
      Store_ID: store.id,
      'Store Name': store.storeName,
      City: store.city || '',
      partneraBrandIds: store.partnerBrandIds?.join(', ') || '',
      partnerBrandTypes: store.partnerBrandTypes?.join(', ') || '',
      Executive_IDs: store.executiveStores
        .map(es => es.executive.id)
        .join(', '),
      "POC's Name": store.executiveStores
        .map(es => es.executive.name)
        .join(', '),
      'Number of Visits': store._count.visits
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths for better readability
    const columnWidths = [
      { wch: 15 }, // Store_ID
      { wch: 35 }, // Store Name
      { wch: 20 }, // City
      { wch: 20 }, // partneraBrandIds
      { wch: 20 }, // partnerBrandTypes
      { wch: 40 }, // Executive_IDs
      { wch: 40 }, // POC's Name
      { wch: 20 }  // Number of Visits
    ];
    ws['!cols'] = columnWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stores');

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Return as file download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stores-export-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Store export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export stores' },
      { status: 500 }
    );
  }
}
