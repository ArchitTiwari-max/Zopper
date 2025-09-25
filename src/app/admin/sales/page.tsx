'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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

      {/* Stats Cards */}
      {stats && (
        <div className="view-sales-stats-grid">
          <div className="view-sales-stat-card">
            <div className="view-sales-stat-value">{stats.totalDeviceSales.toLocaleString()}</div>
            <div className="view-sales-stat-label">Total Device Sales</div>
          </div>
          <div className="view-sales-stat-card">
            <div className="view-sales-stat-value">{stats.totalPlanSales.toLocaleString()}</div>
            <div className="view-sales-stat-label">Total Plan Sales</div>
          </div>
          <div className="view-sales-stat-card">
            <div className="view-sales-stat-value">{(stats.averageAttachPct * 100).toFixed(1)}%</div>
            <div className="view-sales-stat-label">Average Attach Rate</div>
          </div>
          <div className="view-sales-stat-card">
            <div className="view-sales-stat-value">{formatCurrency(stats.totalRevenue)}</div>
            <div className="view-sales-stat-label">Total Revenue</div>
          </div>
        </div>
      )}

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
          <h2>Sales Records ({tableData.length} Brand-Category combinations)</h2>
        </div>
        <div className="view-sales-table">
          <div className="view-sales-table-content">
            <div className="view-sales-table-header-row">
              <div className="view-sales-table-header-cell brand-name-col">Brand Name</div>
              <div className="view-sales-table-header-cell category-col">Category</div>
              {/* All 12 Months */}
              {Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;
                const year = selectedYear;
                return (
                  <div key={month} className="view-sales-table-header-cell month-group">
                    <div className="month-header">{getMonthName(month)} {year.toString().slice(-2)}</div>
                    <div className="month-subheaders">
                      <div>Device Sales</div>
                      <div>Plan Sales</div>
                      <div>Attach %</div>
                      <div>Revenue</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="view-sales-table-body">
            {tableData.length > 0 ? (
              tableData.map((row, index) => {
                return (
                  <div key={`${row.brandName}-${row.categoryName}`} className="view-sales-table-row">
                    <div className="view-sales-table-cell brand-name-cell">
                      <span 
                        className="view-sales-brand-tag" 
                        style={{ backgroundColor: getBrandColor(row.brandName) }}
                      >
                        {row.brandName}
                      </span>
                    </div>
                    <div className="view-sales-table-cell category-cell">{row.categoryName}</div>
                    
                    {/* All 12 Months Data */}
                    {Array.from({ length: 12 }, (_, index) => {
                      const month = index + 1;
                      const monthData = row.months[month];
                      return (
                        <div key={month} className="view-sales-table-cell month-data-group">
                          <div className="month-data-row">
                            <div className="data-cell">{monthData?.deviceSales?.toLocaleString() || '-'}</div>
                            <div className="data-cell">{monthData?.planSales?.toLocaleString() || '-'}</div>
                            <div className="data-cell">{monthData ? `${(monthData.attachPct * 100).toFixed(1)}%` : '-'}</div>
                            <div className="data-cell">{monthData ? formatCurrency(monthData.revenue) : '-'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div className="view-sales-no-data">
                No sales data found for the selected filters.
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Brand Performance Summary */}
      {stats && (
        <div className="view-sales-summary-section">
          <h2>Performance Summary</h2>
          <div className="view-sales-summary-grid">
            <div className="view-sales-summary-card">
              <h3>Top Performing Brands</h3>
              <div className="view-sales-performance-list">
                <div className="view-sales-performance-header">
                  <span className="view-sales-header-brand">Brand Name</span>
                  <span className="view-sales-header-value">Total Revenue</span>
                </div>
                {Object.entries(stats.salesByBrand)
                  .sort(([,a], [,b]) => b.revenue - a.revenue)
                  .slice(0, 3)
                  .map(([brand, data]) => (
                    <div key={brand} className="view-sales-performance-item">
                      <span className="view-sales-brand-name">{brand}</span>
                      <span className="view-sales-performance-value">{formatCurrency(data.revenue)}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="view-sales-summary-card">
              <h3>Category Performance</h3>
              <div className="view-sales-performance-list">
                <div className="view-sales-performance-header">
                  <span className="view-sales-header-category">Category Name</span>
                  <span className="view-sales-header-value">Total Revenue</span>
                </div>
                {Object.entries(stats.salesByCategory)
                  .sort(([,a], [,b]) => b.revenue - a.revenue)
                  .map(([category, data]) => (
                    <div key={category} className="view-sales-performance-item">
                      <span className="view-sales-category-name">{category}</span>
                      <span className="view-sales-performance-value">{formatCurrency(data.revenue)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSalesPage;