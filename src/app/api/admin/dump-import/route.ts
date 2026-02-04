import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Column mapping for Godrej brand
const GODREJ_COLUMN_MAPPING: { [key: string]: string } = {
    'Warranty Activation Code': 'warrantyActivationCode',
    'Customer Premium': 'customerPremium',
    'Zopper Plan Duration': 'zopperPlanDuration',
    'Warranty Purchase Date': 'warrantyPurchaseDate',
    'Warranty Start Date': 'warrantyStartDate',
    'Technician_UserID': 'technicianUserId',
    'Technician_Name': 'technicianName',
    'Service_Centre_Name': 'serviceCentreName',
    'Business Name': 'businessName',
    'PinCode': 'pinCode',
    'Customer_City': 'customerCity',
    'Customer_State': 'customerState',
    'Product Purchased Date': 'productPurchasedDate',
    'Appliance Model Name': 'applianceModelName',
    'Product_Category_ID': 'productCategoryId',
    'Model Code': 'modelCode',
    'Product_Category': 'productCategory',
    'Product_Coverage': 'productCoverage',
    'Product_Serial_Number': 'productSerialNumber',
    'Branch': 'branch',
    'POC Name': 'pocName',
    'Channel': 'channel'
};

// Date fields that need special handling
const DATE_FIELDS = [
    'Warranty Purchase Date',
    'Warranty Start Date',
    'Product Purchased Date'
];

/**
 * Convert Excel serial date to DD/MMM/YY format
 * Excel stores dates as numbers (days since 1/1/1900)
 */
function excelSerialToDate(serial: any): string | null {
    if (!serial) return null;

    // If it's already a string in date format, return it
    if (typeof serial === 'string' && serial.includes('/')) {
        return serial;
    }

    // Convert to number if it's a string number
    const serialNumber = typeof serial === 'string' ? parseFloat(serial) : serial;

    // Check if it's a valid number
    if (isNaN(serialNumber)) {
        return String(serial);
    }

    // Excel date serial starts from 1/1/1900
    // JavaScript Date starts from 1/1/1970
    // Excel incorrectly considers 1900 a leap year, so we need to account for that
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const date = new Date(excelEpoch.getTime() + serialNumber * 24 * 60 * 60 * 1000);

    // Format as DD/MMM/YY
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);

    return `${day}/${month}/${year}`;
}

// POST: Upload dump data
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { brand, data } = body;

        console.log('Dump import request:', { brand, dataLength: data?.length });

        if (!brand || !data || !Array.isArray(data)) {
            return NextResponse.json(
                { success: false, error: 'Invalid request data' },
                { status: 400 }
            );
        }

        // Process and save data based on brand
        const savedRecords = [];

        for (const row of data) {
            let recordData: any = {
                brandName: brand
            };

            if (brand === 'Godrej') {
                // Map Excel columns to database fields
                for (const [excelColumn, dbField] of Object.entries(GODREJ_COLUMN_MAPPING)) {
                    const value = row[excelColumn];

                    // Special handling for date fields
                    if (DATE_FIELDS.includes(excelColumn)) {
                        recordData[dbField] = excelSerialToDate(value);
                    } else {
                        recordData[dbField] = value ? String(value) : null;
                    }
                }
            } else {
                // For other brands, store in additionalData JSON field
                recordData.additionalData = row;
            }

            try {
                // Save to database
                const saved = await prisma.brandDump.create({
                    data: recordData
                });
                savedRecords.push(saved);
            } catch (dbError: any) {
                console.error('Database error for row:', dbError);
                console.error('Record data:', recordData);
                throw new Error(`Database error: ${dbError.message}`);
            }
        }

        console.log('Successfully saved records:', savedRecords.length);

        return NextResponse.json({
            success: true,
            count: savedRecords.length,
            message: `Successfully imported ${savedRecords.length} records for ${brand}`
        });

    } catch (error: any) {
        console.error('Dump import error:', error);
        console.error('Error stack:', error.stack);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to import dump data' },
            { status: 500 }
        );
    }
}

// GET: Fetch dump data with optional filters
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const brand = searchParams.get('brand');
        const date = searchParams.get('date');

        if (!brand) {
            return NextResponse.json(
                { success: false, error: 'Brand parameter is required' },
                { status: 400 }
            );
        }

        // Build query filters
        const where: any = { brandName: brand };

        if (date) {
            // Filter by date (uploaded on that specific day)
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);

            where.uploadedAt = {
                gte: startDate,
                lte: endDate
            };
        }

        // Fetch dumps from database
        const dumps = await prisma.brandDump.findMany({
            where,
            orderBy: { uploadedAt: 'desc' }
        });

        // Transform data for frontend
        const transformedDumps = dumps.map(dump => {
            if (brand === 'Godrej') {
                // Map database fields back to Excel column names
                const transformed: any = {};
                for (const [excelColumn, dbField] of Object.entries(GODREJ_COLUMN_MAPPING)) {
                    transformed[excelColumn] = (dump as any)[dbField] || null;
                }
                transformed.id = dump.id;
                transformed.uploadedAt = dump.uploadedAt;
                return transformed;
            } else {
                // For other brands, return additionalData
                return {
                    id: dump.id,
                    uploadedAt: dump.uploadedAt,
                    ...(dump.additionalData as object || {})
                };
            }
        });

        return NextResponse.json({
            success: true,
            dumps: transformedDumps,
            count: transformedDumps.length
        });

    } catch (error) {
        console.error('Fetch dumps error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch dump data' },
            { status: 500 }
        );
    }
}
