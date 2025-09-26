'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import './view-sales.css';

interface MonthlySalesData {
  month: number;
  deviceSales: number;
  planSales: number;
  attachPct: number;
  revenue: number;
}

interface SalesRecord {
  id: string;
  storeId: string;
  brandId: string;
  categoryId: string;
  year: number;
  monthlySales: MonthlySalesData[];
  // For display purposes
  brandName: string;
  categoryName: string;
}

interface SalesData {
  id: string;
  storeId: string;
  storeName: string;
  brandName: string;
  categoryName: string;
  month: number;
  year: number;
  deviceSales: number;
  planSales: number;
  attachPct: number;
  revenue: number;
}

interface StoreSalesStats {
  totalDeviceSales: number;
  totalPlanSales: number;
  totalRevenue: number;
  averageAttachPct: number;
  salesByBrand: { [brand: string]: { devices: number; plans: number; revenue: number } };
  salesByCategory: { [category: string]: { devices: number; plans: number; revenue: number } };
}

const AdminSalesPage: React.FC = () => {
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');
  const storeName = searchParams.get('storeName') || 'Unknown Store';

  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [stats, setStats] = useState<StoreSalesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');

  // Sample data generator using new monthly structure
  const generateSampleSalesData = (storeId: string, storeName: string): SalesData[] => {
    const brands = ['Samsung', 'Havells', 'Godrej'];
    const categories = ['Smartphone', 'Laptop', 'Tab', 'SmartWatch', 'AC', 'Washing Machine', 'Refrigerator', 'Others'];
    const sampleData: SalesData[] = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Generate sales records for each brand-category combination
    brands.forEach(brand => {
      categories.forEach(category => {
        // Generate monthly data for current year (all 12 months)
        for (let month = 1; month <= 12; month++) {
          const avgRevenuePerDevice = category === 'Smartphone' ? 15000 : 
                                     category === 'Tablet' ? 25000 : 
                                     category === 'Wearables' ? 8000 : 3000;
          
          // Base sales with some randomization
          const baseDeviceSales = Math.floor(Math.random() * 100) + 20; // 20-120 devices per month
          const seasonalMultiplier = getSeasonalMultiplier(month, category);
          const deviceSales = Math.floor(baseDeviceSales * seasonalMultiplier);
          
          const attachRate = 0.4 + Math.random() * 0.3; // 40-70% attach rate
          const planSales = Math.floor(deviceSales * attachRate);
          const attachPct = deviceSales > 0 ? planSales / deviceSales : 0;
          const revenue = deviceSales * avgRevenuePerDevice;

          sampleData.push({
            id: `${storeId}-${currentYear}-${month}-${brand}-${category}`,
            storeId,
            storeName,
            brandName: brand,
            categoryName: category,
            month,
            year: currentYear,
            deviceSales,
            planSales,
            attachPct: Math.round(attachPct * 100) / 100,
            revenue
          });
        }
      });
    });

    return sampleData.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return a.brandName.localeCompare(b.brandName);
    });
  };

  // Helper function for seasonal sales variations
  const getSeasonalMultiplier = (month: number, category: string): number => {
    // Festival seasons in India: Oct-Nov (Diwali), Mar-Apr (Holi/New Year)
    const festivalMonths = [3, 4, 10, 11];
    const isFestivalMonth = festivalMonths.includes(month);
    
    let multiplier = 1.0;
    
    if (isFestivalMonth) {
      multiplier = category === 'Smartphone' ? 1.5 : 1.3; // Higher sales during festivals
    } else if (month === 12 || month === 1) {
      multiplier = 1.2; // Year-end/New year sales
    } else if ([6, 7, 8].includes(month)) {
      multiplier = 0.8; // Lower sales during monsoon
    }
    
    return multiplier;
  };

  const calculateStats = (data: SalesData[]): StoreSalesStats => {
    const totalDeviceSales = data.reduce((sum, item) => sum + item.deviceSales, 0);
    const totalPlanSales = data.reduce((sum, item) => sum + item.planSales, 0);
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const averageAttachPct = totalDeviceSales > 0 ? Math.round((totalPlanSales / totalDeviceSales) * 100) / 100 : 0;

    const salesByBrand: { [brand: string]: { devices: number; plans: number; revenue: number } } = {};
    const salesByCategory: { [category: string]: { devices: number; plans: number; revenue: number } } = {};

    data.forEach(item => {
      // By Brand
      if (!salesByBrand[item.brandName]) {
        salesByBrand[item.brandName] = { devices: 0, plans: 0, revenue: 0 };
      }
      salesByBrand[item.brandName].devices += item.deviceSales;
      salesByBrand[item.brandName].plans += item.planSales;
      salesByBrand[item.brandName].revenue += item.revenue;

      // By Category
      if (!salesByCategory[item.categoryName]) {
        salesByCategory[item.categoryName] = { devices: 0, plans: 0, revenue: 0 };
      }
      salesByCategory[item.categoryName].devices += item.deviceSales;
      salesByCategory[item.categoryName].plans += item.planSales;
      salesByCategory[item.categoryName].revenue += item.revenue;
    });

    return {
      totalDeviceSales,
      totalPlanSales,
      totalRevenue,
      averageAttachPct,
      salesByBrand,
      salesByCategory
    };
  };

  useEffect(() => {
    if (storeId) {
      setLoading(true);
      // Simulate API call delay
      setTimeout(() => {
        const sampleData = generateSampleSalesData(storeId, storeName);
        setSalesData(sampleData);
        setStats(calculateStats(sampleData));
        setLoading(false);
      }, 500);
    }
  }, [storeId, storeName]);

  const filteredData = salesData.filter(item => {
    if (item.year !== selectedYear) return false;
    if (selectedBrand !== 'All Brands' && item.brandName !== selectedBrand) return false;
    if (selectedCategory !== 'All Categories' && item.categoryName !== selectedCategory) return false;
    return true;
  });

  // Group data by brand and category for the table format
  const groupedData = filteredData.reduce((acc, item) => {
    const key = `${item.brandName}-${item.categoryName}`;
    if (!acc[key]) {
      acc[key] = {
        brandName: item.brandName,
        categoryName: item.categoryName,
        months: {}
      };
    }
    acc[key].months[item.month] = {
      deviceSales: item.deviceSales,
      planSales: item.planSales,
      attachPct: item.attachPct,
      revenue: item.revenue
    };
    return acc;
  }, {} as Record<string, {
    brandName: string;
    categoryName: string;
    months: Record<number, {
      deviceSales: number;
      planSales: number;
      attachPct: number;
      revenue: number;
    }>;
  }>);

  const tableData = Object.values(groupedData);

  const recentMonths = getRecentMonthsForYear(selectedYear, 3);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getMonthName = (month: number): string => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return monthNames[month - 1];
  };

  // Get the previous N months within a given year (excluding current month).
  // Returns months in reverse chronological order (most recent first).
  // If the selected year is the current year, it ends at the previous month;
  // otherwise, it ends at December. This does not cross year boundaries.
  function getRecentMonthsForYear(year: number, count: number): number[] {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    
    let endMonth: number;
    if (year === currentYear) {
      // For current year, show previous months (exclude current month)
      endMonth = currentMonth - 1;
    } else {
      // For previous years, show up to December
      endMonth = 12;
    }
    
    const startMonth = Math.max(1, endMonth - count + 1);
    const months: number[] = [];
    // Build months in reverse order (most recent first)
    for (let m = endMonth; m >= startMonth; m--) months.push(m);
    return months;
  }

  const formatMonth = (month: number, year: number): string => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    if (year === currentYear && month === currentMonth) {
      return `${monthNames[month - 1]} ${year} (Current)`;
    }
    
    return `${monthNames[month - 1]} ${year}`;
  };

  const getBrandColor = (brand: string): string => {
    const brandColors: Record<string, string> = {
      'Samsung': '#1DB584',
      'Havells': '#E11D48',
      'Godrej': '#059669'
    };
    return brandColors[brand] || '#64748b';
  };

  // Build CSV from the currently displayed tableData and recentMonths

  // Build AOA (array of arrays) for Excel export
  const buildAOA = (): (string | number)[][] => {
    const monthHeaders = recentMonths.flatMap((month) => {
      const year = selectedYear;
      const label = `${getMonthName(month)} ${year.toString().slice(-2)}`;
      return [
        `${label} Device Sales`,
        `${label} Plan Sales`,
        `${label} Attach %`,
        `${label} Revenue`
      ];
    });

    const headers = ['Brand', 'Category', ...monthHeaders];

    const rows = tableData.map((row) => {
      const cols: (string | number)[] = [row.brandName, row.categoryName];
      recentMonths.forEach((month) => {
        const monthData = row.months[month];
        cols.push(
          monthData?.deviceSales ?? '',
          monthData?.planSales ?? '',
          monthData ? `${(monthData.attachPct * 100).toFixed(1)}%` : '',
          monthData?.revenue ?? ''
        );
      });
      return cols;
    });

    return [headers, ...rows];
  };


  // Export in legacy Excel .xls format
  const handleExportXLS = () => {
    const aoa = buildAOA();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Optional: set some reasonable column widths
    const colCount = aoa[0]?.length || 0;
    const cols = Array.from({ length: colCount }, (_, i) => ({ wch: i < 2 ? 16 : 14 }));
    (ws as any)['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Sales_${selectedYear}`);

    const safeStore = (storeName || 'store').replace(/[^a-zA-Z0-9-_]+/g, '_');
    const filename = `sales-report-${safeStore}-${selectedYear}.xls`;
    XLSX.writeFile(wb, filename, { bookType: 'xls' });
  };

  if (!storeId) {
    return (
      <div className="view-sales-admin-page">
        <div className="view-sales-error-container">
          <h2>Store ID Required</h2>
          <p>Please select a store to view sales data.</p>
          <Link href="/admin/stores" className="view-sales-back-link">← Back to Stores</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="view-sales-admin-page">
        <div className="view-sales-loading-container">
          <div className="view-sales-loading-spinner"></div>
          <p>Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view-sales-admin-page">
      {/* Header */}
      <div className="view-sales-header">
        <div className="view-sales-breadcrumb">
          <Link href="/admin/stores" className="view-sales-breadcrumb-link">Stores</Link>
          <span className="view-sales-breadcrumb-separator">→</span>
          <span className="view-sales-breadcrumb-current">Sales Data</span>
        </div>
        <h1 className="view-sales-page-title">Sales Data for {storeName}</h1>
      </div>


      {/* Filters */}
      <div className="view-sales-filters-section">
        <div className="view-sales-filter-group">
          <label>Year:</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {Array.from(new Set(salesData.map(item => item.year))).sort((a, b) => b - a).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="view-sales-filter-group">
          <label>Brand:</label>
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
            <option value="All Brands">All Brands</option>
            {Array.from(new Set(salesData.filter(item => item.year === selectedYear).map(item => item.brandName))).map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>
        <div className="view-sales-filter-group">
          <label>Category:</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="All Categories">All Categories</option>
            {Array.from(new Set(salesData.filter(item => item.year === selectedYear).map(item => item.categoryName))).map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sales Data Table */}
      <div className="view-sales-table-container">
        <div className="view-sales-table-header">
          <div className="view-sales-table-header-content">
            <h2>Sales Records </h2>
            <div className="view-sales-actions">
              <button type="button" className="view-sales-export-btn" onClick={handleExportXLS}>
                Export Excel
              </button>
            </div>
          </div>
        </div>
        <div className="view-sales-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }} rowSpan={2}>BRAND</th>
                <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }} rowSpan={2}>CATEGORY</th>
                <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }} colSpan={4}>AUG 25</th>
                <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }} colSpan={4}>JUL 25</th>
                <th style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }} colSpan={4}>JUN 25</th>
              </tr>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>DS</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>PS</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>AP</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>REV</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>DS</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>PS</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>AP</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>REV</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>DS</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>PS</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>AP</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>REV</th>
              </tr>
            </thead>
            <tbody>
            {tableData.length > 0 ? (() => {
              // Group data by brand and sort
              const brandGroups = tableData.reduce((acc, row) => {
                if (!acc[row.brandName]) {
                  acc[row.brandName] = [];
                }
                acc[row.brandName].push(row);
                return acc;
              }, {} as Record<string, typeof tableData>);

              const brandNames = Object.keys(brandGroups).sort();
              const allRows: React.ReactNode[] = [];

              brandNames.forEach(brandName => {
                const brandRows = brandGroups[brandName];
                brandRows.forEach((row, brandRowIndex) => {
                  const augData = row.months[recentMonths[0]]; // Most recent month
                  const julData = row.months[recentMonths[1]]; // Second most recent
                  const junData = row.months[recentMonths[2]]; // Oldest month

                  allRows.push(
                    <tr key={`${row.brandName}-${row.categoryName}`}>
                      {brandRowIndex === 0 && (
                        <td
                          style={{
                            border: '1px solid #ccc',
                            padding: '10px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            backgroundColor: '#fff'
                          }}
                          rowSpan={brandRows.length}
                        >
                          <span
                            style={{
                              backgroundColor: getBrandColor(row.brandName),
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          >
                            {row.brandName}
                          </span>
                        </td>
                      )}
                      <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'left' }}>
                        {row.categoryName}
                      </td>
                      {/* AUG 25 Data (Most Recent) */}
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {augData?.deviceSales || ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {augData?.planSales || ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {augData?.attachPct ? `${(augData.attachPct * 100).toFixed(1)}%` : ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {augData?.revenue ? formatCurrency(augData.revenue) : ''}
                      </td>
                      {/* JUL 25 Data */}
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {julData?.deviceSales || ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {julData?.planSales || ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {julData?.attachPct ? `${(julData.attachPct * 100).toFixed(1)}%` : ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {julData?.revenue ? formatCurrency(julData.revenue) : ''}
                      </td>
                      {/* JUN 25 Data (Oldest) */}
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {junData?.deviceSales || ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {junData?.planSales || ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {junData?.attachPct ? `${(junData.attachPct * 100).toFixed(1)}%` : ''}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {junData?.revenue ? formatCurrency(junData.revenue) : ''}
                      </td>
                    </tr>
                  );
                });
              });

              return allRows;
            })() : (
              <tr>
                <td colSpan={14} style={{ border: '1px solid #ccc', padding: '20px', textAlign: 'center' }}>
                  No sales data found for the selected filters.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AdminSalesPage;