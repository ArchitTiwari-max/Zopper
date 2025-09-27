'use client';

import React, { useMemo, useState, useEffect } from 'react';
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

interface DailySalesData {
  id: string;
  storeId: string;
  storeName: string;
  brandName: string;
  categoryName: string;
  year: number;
  date: string;
  countOfSales: number;
  revenue: number;
  displayDate: string;
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
  
  // Date-wise sales states
  const [showDatewise, setShowDatewise] = useState(true);
  const [dateWiseBrand, setDateWiseBrand] = useState('All Brands');
  const [currentMonthData, setCurrentMonthData] = useState<SalesData[]>([]);
  const [dailySalesData, setDailySalesData] = useState<DailySalesData[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

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

  // Fetch real sales data from API
  const fetchSalesData = async () => {
    if (!storeId) {
      console.error('Store ID not found');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const params = new URLSearchParams({ storeId });
      const response = await fetch(`/api/sales?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSalesData(result.data);
        setStats(calculateStats(result.data));
      } else {
        console.error('Failed to fetch sales data:', result.error);
        // Fallback to sample data if API fails
        const sampleData = generateSampleSalesData(storeId, storeName);
        setSalesData(sampleData);
        setStats(calculateStats(sampleData));
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
      // Fallback to sample data if API fails
      const sampleData = generateSampleSalesData(storeId, storeName);
      setSalesData(sampleData);
      setStats(calculateStats(sampleData));
    } finally {
      setLoading(false);
    }
  };

  // Fetch daily sales data from API
  const fetchDailySalesData = async () => {
    if (!storeId) {
      console.error('Store ID not found for daily sales');
      return;
    }
    
    setDailyLoading(true);
    
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      const params = new URLSearchParams({ 
        storeId, 
        year: currentYear.toString(),
        month: currentMonth.toString()
      });
      
      const response = await fetch(`/api/sales/daily?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setDailySalesData(result.data);
      } else {
        console.error('Failed to fetch daily sales data:', result.error);
        setDailySalesData([]);
      }
    } catch (error) {
      console.error('Error fetching daily sales data:', error);
      setDailySalesData([]);
    } finally {
      setDailyLoading(false);
    }
  };
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const currentMonthSales = salesData.filter(item => 
      item.year === currentYear && item.month === currentMonth
    );
    
    setCurrentMonthData(currentMonthSales);
  }, [salesData]);

  useEffect(() => {
    if (storeId) {
      fetchSalesData();
      fetchDailySalesData();
    }
  }, [storeId]);

  const filteredData = salesData;

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

  // Get the actual months from the filtered data
  const actualMonths = Array.from(new Set(
    filteredData.map(item => item.month)
  )).sort((a, b) => b - a).slice(0, 3); // Get latest 3 months, descending
  
  const currentYear = new Date().getFullYear();
  const recentMonths = actualMonths.length > 0 ? actualMonths : getRecentMonthsForYear(currentYear, 3);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Helper functions for date-wise sales
  const formatDateDDMMYYYY = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const getDaysInMonth = (year: number, monthIndex0: number) => {
    return new Date(year, monthIndex0 + 1, 0).getDate();
  };

  const getCurrentMonthLabel = () => {
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[now.getMonth()]} ${String(now.getFullYear()).slice(2)}`;
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
      const currentYear = new Date().getFullYear();
      const monthHeaders = recentMonths.flatMap((month) => {
        const label = `${getMonthName(month)} ${currentYear.toString().slice(-2)}`;
        return [
          `${label} Device Sales`,
          `${label} Plan Sales`, 
          `${label} Attach Percentage`,
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
    const currentYear = new Date().getFullYear();
    XLSX.utils.book_append_sheet(wb, ws, `Sales_${currentYear}`);

    const safeStore = (storeName || 'store').replace(/[^a-zA-Z0-9-_]+/g, '_');
    const filename = `sales-report-${safeStore}-${currentYear}.xls`;
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

      {/* Date wise sales of current month */}
      <div className="view-sales-datewise-section" style={{ marginBottom: '40px' }}>
        <div className="view-sales-datewise-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '15px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            Daily Sales - {getCurrentMonthLabel()}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="datewise-brand" style={{ 
                fontSize: '14px', 
                fontWeight: '500',
                color: '#495057'
              }}>Brand:</label>
              <select 
                id="datewise-brand" 
                value={dateWiseBrand} 
                onChange={(e) => setDateWiseBrand(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  fontSize: '14px'
                }}
              >
                <option value="All Brands">All Brands</option>
                {Array.from(new Set(dailySalesData.map(item => item.brandName))).map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowDatewise(!showDatewise)}
              style={{
                padding: '6px 16px',
                borderRadius: '4px',
                border: '1px solid #007bff',
                backgroundColor: showDatewise ? '#007bff' : 'white',
                color: showDatewise ? 'white' : '#007bff',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {showDatewise ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        
        {showDatewise && (
          <div className="view-sales-datewise-table" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #e9ecef'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ 
                    border: '1px solid #dee2e6', 
                    padding: '12px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#495057'
                  }}>Date</th>
                  <th style={{ 
                    border: '1px solid #dee2e6', 
                    padding: '12px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#495057'
                  }}>Category</th>
                  <th style={{ 
                    border: '1px solid #dee2e6', 
                    padding: '12px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#495057'
                  }}>Plan Sales</th>
                  <th style={{ 
                    border: '1px solid #dee2e6', 
                    padding: '12px', 
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#495057'
                  }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  if (dailyLoading) {
                    return (
                      <tr>
                        <td colSpan={4} style={{ 
                          border: '1px solid #dee2e6', 
                          padding: '20px', 
                          textAlign: 'center',
                          color: '#6c757d'
                        }}>
                          Loading daily sales data...
                        </td>
                      </tr>
                    );
                  }
                  
                  // Filter daily sales data by selected brand
                  const filteredDailySales = dateWiseBrand === 'All Brands' 
                    ? dailySalesData 
                    : dailySalesData.filter(item => item.brandName === dateWiseBrand);
                  
                  if (filteredDailySales.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} style={{ 
                          border: '1px solid #dee2e6', 
                          padding: '20px', 
                          textAlign: 'center',
                          color: '#6c757d',
                          fontStyle: 'italic'
                        }}>
                          No daily sales data available for current month
                        </td>
                      </tr>
                    );
                  }
                  
                  // Group by date, then show each category for that date
                  const groupedByDate: Record<string, DailySalesData[]> = {};
                  filteredDailySales.forEach(item => {
                    if (!groupedByDate[item.displayDate]) {
                      groupedByDate[item.displayDate] = [];
                    }
                    groupedByDate[item.displayDate].push(item);
                  });
                  
                  const dates = Object.keys(groupedByDate).sort((a, b) => {
                    const dateA = new Date(a.split('-').reverse().join('-'));
                    const dateB = new Date(b.split('-').reverse().join('-'));
                    return dateB.getTime() - dateA.getTime();
                  });
                  
                  const rowsEls: React.ReactNode[] = [];
                  
                  dates.forEach(dateStr => {
                    const dayData = groupedByDate[dateStr];
                    dayData.forEach((item, idx) => {
                      rowsEls.push(
                        <tr key={`${dateStr}-${item.categoryName}`} style={{
                          backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white'
                        }}>
                          {idx === 0 && (
                            <td 
                              rowSpan={dayData.length} 
                              style={{ 
                                border: '1px solid #dee2e6', 
                                padding: '10px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                fontWeight: '500',
                                backgroundColor: '#e9ecef'
                              }}
                            >
                              {dateStr}
                            </td>
                          )}
                          <td style={{ 
                            border: '1px solid #dee2e6', 
                            padding: '10px',
                            textAlign: 'center'
                          }}>
                            {item.categoryName}
                          </td>
                          <td style={{ 
                            border: '1px solid #dee2e6', 
                            padding: '10px',
                            textAlign: 'center'
                          }}>
                            {item.countOfSales || 0}
                          </td>
                          <td style={{ 
                            border: '1px solid #dee2e6', 
                            padding: '10px',
                            textAlign: 'center'
                          }}>
                            {formatCurrency(item.revenue || 0)}
                          </td>
                        </tr>
                      );
                    });
                  });
                  
                  return rowsEls;
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Monthly Sales Section */}
      <div className="view-sales-monthwise-section" style={{ marginTop: '40px', marginBottom: '30px' }}>
        <div className="view-sales-monthwise-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '15px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            Monthly Sales Summary
          </h3>
          <div className="view-sales-actions">
            <button 
              type="button" 
              onClick={handleExportXLS}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: '1px solid #28a745',
                backgroundColor: '#28a745',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Export Excel
            </button>
          </div>
        </div>
        
        <div className="view-sales-monthwise-table" style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #e9ecef'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            tableLayout: 'fixed'
          }}>
            <colgroup>
              <col style={{ width: '12%' }} /> {/* Brand */}
              <col style={{ width: '15%' }} /> {/* Category */}
              <col style={{ width: '8%' }} />  {/* Device Sales */}
              <col style={{ width: '8%' }} />  {/* Plan Sales */}
              <col style={{ width: '8%' }} />  {/* Attach % */}
              <col style={{ width: '10%' }} /> {/* Revenue */}
              <col style={{ width: '8%' }} />  {/* Device Sales */}
              <col style={{ width: '8%' }} />  {/* Plan Sales */}
              <col style={{ width: '8%' }} />  {/* Attach % */}
              <col style={{ width: '10%' }} /> {/* Revenue */}
              <col style={{ width: '8%' }} />  {/* Device Sales */}
              <col style={{ width: '8%' }} />  {/* Plan Sales */}
              <col style={{ width: '8%' }} />  {/* Attach % */}
              <col style={{ width: '10%' }} /> {/* Revenue */}
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ 
                  border: '1px solid #ccc', 
                  padding: '12px 8px', 
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  wordWrap: 'break-word'
                }} rowSpan={2}>BRAND</th>
                <th style={{ 
                  border: '1px solid #ccc', 
                  padding: '12px 8px', 
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  wordWrap: 'break-word'
                }} rowSpan={2}>CATEGORY</th>
                {recentMonths.map((month) => (
                  <th key={month} style={{ 
                    border: '1px solid #ccc', 
                    padding: '12px 8px', 
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }} colSpan={4}>{getMonthName(month).toUpperCase()} {currentYear.toString().slice(-2)}</th>
                ))}
              </tr>
              <tr style={{ backgroundColor: '#f9f9f9' }}>
                {recentMonths.map((month) => (
                  <React.Fragment key={`subheader-${month}`}>
                    <th style={{ 
                      border: '1px solid #ccc', 
                      padding: '8px 4px', 
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      wordWrap: 'break-word',
                      lineHeight: '1.2'
                    }}>Device<br/>Sales</th>
                    <th style={{ 
                      border: '1px solid #ccc', 
                      padding: '8px 4px', 
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      wordWrap: 'break-word',
                      lineHeight: '1.2'
                    }}>Plan<br/>Sales</th>
                    <th style={{ 
                      border: '1px solid #ccc', 
                      padding: '8px 4px', 
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      wordWrap: 'break-word',
                      lineHeight: '1.2'
                    }}>Attach<br/>%</th>
                    <th style={{ 
                      border: '1px solid #ccc', 
                      padding: '8px 4px', 
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      wordWrap: 'break-word',
                      lineHeight: '1.2'
                    }}>Revenue</th>
                  </React.Fragment>
                ))}
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
                    allRows.push(
                    <tr key={`${row.brandName}-${row.categoryName}`}>
                      {brandRowIndex === 0 && (
                        <td
                          style={{
                            border: '1px solid #ccc',
                            padding: '12px 8px',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            backgroundColor: '#fff',
                            wordWrap: 'break-word',
                            minHeight: '50px'
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
                      <td style={{ 
                        border: '1px solid #ccc', 
                        padding: '12px 8px', 
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        wordWrap: 'break-word',
                        fontSize: '12px',
                        minHeight: '50px'
                      }}>
                        {row.categoryName}
                      </td>
                      {/* Dynamic Month Data */}
                      {recentMonths.map((month) => {
                        const monthData = row.months[month];
                        return (
                          <React.Fragment key={`${row.brandName}-${row.categoryName}-${month}`}>
                            <td style={{ 
                              border: '1px solid #ccc', 
                              padding: '10px 6px', 
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              fontSize: '11px',
                              wordWrap: 'break-word',
                              minHeight: '50px'
                            }}>
                              {monthData?.deviceSales ?? ''}
                            </td>
                            <td style={{ 
                              border: '1px solid #ccc', 
                              padding: '10px 6px', 
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              fontSize: '11px',
                              wordWrap: 'break-word',
                              minHeight: '50px'
                            }}>
                              {monthData?.planSales ?? ''}
                            </td>
                            <td style={{ 
                              border: '1px solid #ccc', 
                              padding: '10px 6px', 
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              fontSize: '11px',
                              wordWrap: 'break-word',
                              minHeight: '50px'
                            }}>
                              {monthData && typeof monthData.attachPct === 'number' ? `${(monthData.attachPct * 100).toFixed(1)}%` : ''}
                            </td>
                            <td style={{ 
                              border: '1px solid #ccc', 
                              padding: '10px 6px', 
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              fontSize: '10px',
                              wordWrap: 'break-word',
                              minHeight: '50px'
                            }}>
                              {monthData && typeof monthData.revenue === 'number' ? formatCurrency(monthData.revenue) : ''}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                });
              });

              return allRows;
            })() : (
                <tr>
                  <td colSpan={2 + (recentMonths.length * 4)} style={{ 
                    border: '1px solid #ccc', 
                    padding: '30px 20px', 
                    textAlign: 'center',
                    fontSize: '14px',
                    color: '#666',
                    backgroundColor: '#f9f9f9'
                  }}>
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