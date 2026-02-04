import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const brand = searchParams.get('brand');
        const startDate = searchParams.get('startDate'); // e.g., "2024-08-01"
        const endDate = searchParams.get('endDate');     // e.g., "2024-08-31"
        const channel = searchParams.get('channel');
        const category = searchParams.get('category');
        const pocName = searchParams.get('pocName'); // Executive filter

        if (!brand) {
            return NextResponse.json(
                { success: false, error: 'Brand is required' },
                { status: 400 }
            );
        }

        // Build query filter (only brand and channel - dates and category filtered client-side)
        const filter: any = { brandName: brand };

        // Add channel filtering if provided
        if (channel) {
            filter.channel = channel;
        }

        // Fetch all dump data for the brand
        let dumpData = await prisma.brandDump.findMany({
            where: filter,
            orderBy: {
                uploadedAt: 'desc'
            }
        });

        // Helper function to parse DD/MMM/YY format to Date object
        const parseWarrantyDate = (dateStr: string): Date | null => {
            const trimmed = dateStr.trim();

            // Parse DD/MMM/YY format (e.g., "06/Aug/24")
            const ddmmmyyMatch = trimmed.match(/^(\d{1,2})[-\/]([a-zA-Z]{3,9})[-\/](\d{2,4})$/);
            if (!ddmmmyyMatch) return null;

            const day = parseInt(ddmmmyyMatch[1]);
            const monthStr = ddmmmyyMatch[2];
            let year = parseInt(ddmmmyyMatch[3]);

            // Convert 2-digit year to 4-digit
            if (year < 100) {
                year = year < 50 ? 2000 + year : 1900 + year;
            }

            // Map month abbreviation to month number (0-indexed)
            const monthMap: Record<string, number> = {
                'jan': 0, 'january': 0,
                'feb': 1, 'february': 1,
                'mar': 2, 'march': 2,
                'apr': 3, 'april': 3,
                'may': 4,
                'jun': 5, 'june': 5,
                'jul': 6, 'july': 6,
                'aug': 7, 'august': 7,
                'sep': 8, 'september': 8,
                'oct': 9, 'october': 9,
                'nov': 10, 'november': 10,
                'dec': 11, 'december': 11
            };

            const month = monthMap[monthStr.toLowerCase()];
            if (month === undefined) return null;

            return new Date(year, month, day);
        };

        // Apply date range filter client-side (since warrantyPurchaseDate is in DD/MMM/YY format)
        if (startDate || endDate) {
            // Set start date to beginning of day (00:00:00)
            const startDateObj = startDate ? new Date(startDate) : null;
            if (startDateObj) {
                startDateObj.setHours(0, 0, 0, 0);
            }

            // Set end date to end of day (23:59:59.999) to make it inclusive
            const endDateObj = endDate ? new Date(endDate) : null;
            if (endDateObj) {
                endDateObj.setHours(23, 59, 59, 999);
            }

            dumpData = dumpData.filter(record => {
                if (!record.warrantyPurchaseDate) return false;

                const recordDate = parseWarrantyDate(record.warrantyPurchaseDate);
                if (!recordDate) return false;

                // Check if date is within range (inclusive on both ends)
                if (startDateObj && recordDate < startDateObj) {
                    return false;
                }

                if (endDateObj && recordDate > endDateObj) {
                    return false;
                }

                return true;
            });
        }

        // Extract unique categories for dropdown (before applying category filter)
        const uniqueCategories = [...new Set(
            dumpData
                .map(record => {
                    let category = record.productCategory?.trim();
                    // Normalize 'REF' to 'Refrigerator' for consistency
                    if (category?.toLowerCase() === 'ref') {
                        category = 'Refrigerator';
                    }
                    return category;
                })
                .filter(cat => cat && cat.length > 0)
        )].sort();

        // Apply category filter client-side (case-insensitive)
        if (category) {
            dumpData = dumpData.filter(record => {
                const recordCategory = record.productCategory?.trim().toLowerCase();
                const filterCategory = category.toLowerCase();

                // Handle Refrigerator/REF mapping
                if (filterCategory === 'refrigerator' && recordCategory === 'ref') {
                    return true;
                }

                return recordCategory === filterCategory;
            });
        }

        // Extract unique POC names for dropdown (before applying POC filter)
        const uniquePocNames = [...new Set(
            dumpData
                .map(record => record.pocName?.trim())
                .filter(name => name && name.length > 0)
        )].sort();

        // Apply POC name filter (Executive filter)
        if (pocName) {
            dumpData = dumpData.filter(record =>
                record.pocName?.trim().toLowerCase() === pocName.toLowerCase()
            );
        }

        // Calculate aggregations
        let totalSales = 0;
        const channelStats: Record<string, { sum: number; count: number }> = {
            'D2D': { sum: 0, count: 0 },
            'POD': { sum: 0, count: 0 },
            'POS': { sum: 0, count: 0 },
            'Telecaller': { sum: 0, count: 0 }
        };

        // Build categoryStats dynamically from available categories
        const categoryStats: Record<string, { sum: number; count: number }> = {};
        uniqueCategories.forEach(category => {
            if (category) {
                categoryStats[category] = { sum: 0, count: 0 };
            }
        });

        // Process each record
        dumpData.forEach((record) => {
            // Parse customer premium as number
            const premium = parseFloat(record.customerPremium || '0') || 0;
            totalSales += premium;

            // Aggregate by channel
            const channelName = record.channel?.trim();
            if (channelName && channelStats[channelName] !== undefined) {
                channelStats[channelName].sum += premium;
                channelStats[channelName].count += 1;
            }

            // Aggregate by product category (case-insensitive matching)
            let categoryName = record.productCategory?.trim();
            if (categoryName) {
                // Map 'REF' to 'Refrigerator' for display consistency
                if (categoryName.toLowerCase() === 'ref') {
                    categoryName = 'Refrigerator';
                }

                // Add to stats if category exists in our dynamic list
                if (categoryStats[categoryName]) {
                    categoryStats[categoryName].sum += premium;
                    categoryStats[categoryName].count += 1;
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                totalSales,
                channelStats,
                categoryStats,
                records: dumpData,
                totalRecords: dumpData.length,
                availableCategories: uniqueCategories,
                availablePocNames: uniquePocNames
            }
        });

    } catch (error) {
        console.error('Error fetching partner dashboard data:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch dashboard data' },
            { status: 500 }
        );
    }
}
