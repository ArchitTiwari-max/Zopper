'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import './Sales.css';

// Interface for sales data
interface SalesData {
  id: string;
  storeId: string;
  storeName: string;
  brandName: string;
  categoryName: string;
  year: number;
  month: number;
  deviceSales: number;
  planSales: number;
  attachPct: number;
  revenue: number;
}

// Interface for daily sales data
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

// Helper to build options for the last 3 months including current
function buildMonthOptions(baseDate: Date = new Date()) {
  const months = [
    'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
  ];
  const out: { value: string; label: string; monthIndex: number }[] = [];
  // Exclude current month; include previous 3 months (newest first)
  for (let i = 1; i <= 3; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
    const year = d.getFullYear();
    const mIndex = d.getMonth();
    const value = `${year}-${String(mIndex + 1).padStart(2, '0')}`; // e.g., 2025-08
    const label = `${months[mIndex]} ${String(year).slice(2)}`; // e.g., Aug 25
    out.push({ value, label, monthIndex: mIndex });
  }
  return out; // newest first (e.g., last month first)
}

// Table data scaffold from the shared image
const rows: { brand: string; category: string }[] = [
  { brand: 'Samsung', category: 'Smartphone' },
  { brand: 'Samsung', category: 'Laptop' },
  { brand: 'Samsung', category: 'Tab' },
  { brand: 'Samsung', category: 'SmartWatch' },
  { brand: 'Havells', category: 'AC' },
  { brand: 'Havells', category: 'Washing Machine' },
  { brand: 'Havells', category: 'Refrigerator' },
  { brand: 'Godrej', category: 'AC' },
  { brand: 'Godrej', category: 'Washing Machine' },
  { brand: 'Godrej', category: 'Refrigerator' },
  { brand: 'Godrej', category: 'Others' },
];

// Date-wise scaffold categories
const dateCategories = ['Smartphone', 'Laptop', 'Tab', 'Smartwatch'];

function formatDateDDMMYYYY(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getDaysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

export default function SalesPage() {
  const monthOptions = useMemo(() => buildMonthOptions(new Date()), []);

  const defaultValue = monthOptions[0].value;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultValue);
  
  // API data state
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Daily sales data state
  const [dailySalesData, setDailySalesData] = useState<DailySalesData[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  const currentLabel = useMemo(() => {
    const hit = monthOptions.find(o => o.value === selectedMonth);
    return hit?.label ?? '';
  }, [selectedMonth, monthOptions]);

  // Current month label for date-wise section
  const currentMonthLabel = useMemo(() => {
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[now.getMonth()]} ${String(now.getFullYear()).slice(2)}`;
  }, []);

  // Brand filter for date-wise section
  const [brand, setBrand] = useState<string>('');

  // Section toggles
  const [showDatewise, setShowDatewise] = useState(true);
  const [showMonthwise, setShowMonthwise] = useState(true);

  const searchParams = useSearchParams();
  const storeName = useMemo(() => {
    const raw = searchParams.get('store');
    return raw ? decodeURIComponent(raw) : 'My Store';
  }, [searchParams]);
  
  const storeId = useMemo(() => {
    return searchParams.get('storeId') || '';
  }, [searchParams]);
  
  // Fetch sales data from API
  const fetchSalesData = async () => {
    if (!storeId) {
      setError('Store ID not found');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ storeId });
      const response = await fetch(`/api/sales?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSalesData(result.data);
      } else {
        setError('Failed to fetch sales data');
        console.error('API Error:', result.error);
      }
    } catch (err) {
      setError('Failed to fetch sales data');
      console.error('Fetch Error:', err);
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
    fetchSalesData();
    fetchDailySalesData();
  }, [storeId]);
  
  // Set the first available brand when daily sales data is loaded
  useEffect(() => {
    if (dailySalesData.length > 0 && !brand) {
      const firstBrand = dailySalesData[0]?.brandName;
      if (firstBrand) {
        setBrand(firstBrand);
      }
    }
  }, [dailySalesData, brand]);
  
  // Process sales data for selected month
  const monthwiseSalesData = useMemo(() => {
    const [year, monthStr] = selectedMonth.split('-');
    const month = parseInt(monthStr, 10);
    
    return salesData.filter(item => 
      item.year === parseInt(year, 10) && item.month === month
    );
  }, [salesData, selectedMonth]);
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };


  return (
    <div className="sales-page-container">
      {/* Back to store link */}
      <nav className="sales-page-back-nav" aria-label="Back navigation">
        <Link href="/executive/store" className="sales-page-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{marginRight: 6}}>
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to store
        </Link>
      </nav>

      {/* Store heading only */}
      <h1 className="sales-page-store-heading" title={storeName} aria-label="Store name">{storeName}</h1>

      {/* Page Header with Title and Subtitle (no store name) */}
      <header className="sales-page-header" aria-label="Page header">
        <div className="sales-page-titles">
          <h1 className="sales-page-title">Sales Summary</h1>
          <p className="sales-page-subtitle">Device, plan, attach %, and revenue overview</p>
        </div>
      </header>

      {/* Date wise sales of latest month */}
      <section className="sales-page-datewise-section" aria-label="Date wise sales of latest month" style={{ marginBottom: '40px' }}>
        <div className="sales-page-monthbar">
          <h2 className="sales-page-month-title">{currentMonthLabel}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="sales-page-month-select">
              <label htmlFor="brand" className="sales-page-visually-hidden">Select Brand</label>
              <select id="brand" value={brand} onChange={(e) => setBrand(e.target.value as any)} aria-label="Select Brand">
                {Array.from(new Set(dailySalesData.map(item => item.brandName))).filter(brand => brand).map(brandName => (
                  <option key={brandName} value={brandName}>{brandName}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="sales-page-toggle"
              onClick={() => setShowDatewise(v => !v)}
              aria-expanded={showDatewise}
              aria-controls="sales-page-datewise-table"
            >
              {showDatewise ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {showDatewise && (
        <div id="sales-page-datewise-table" className="sales-page-table-wrapper">
          <table className="sales-page-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Plan Sales</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                if (dailyLoading) {
                  return (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                        Loading daily sales data...
                      </td>
                    </tr>
                  );
                }
                
                // Filter daily sales data by selected brand
                const filteredDailySales = dailySalesData.filter(item => item.brandName === brand);
                
                if (filteredDailySales.length === 0) {
                  return (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>
                        No daily sales data available for {brand} in current month
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
                      <tr key={`${dateStr}-${item.categoryName}`}>
                        {idx === 0 && (
                          <td rowSpan={dayData.length} data-label="Date">{dateStr}</td>
                        )}
                        <td data-label="Category">{item.categoryName}</td>
                        <td data-label="Plan Sales">{item.countOfSales || 0}</td>
                        <td data-label="Revenue">{formatCurrency(item.revenue || 0)}</td>
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
      </section>

      {/* Month selector banner */}
      <div className="sales-page-monthbar">
        <h2 className="sales-page-month-title">{currentLabel}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="sales-page-month-select">
            <label htmlFor="month" className="sales-page-visually-hidden">Select Month</label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select month"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="sales-page-toggle"
            onClick={() => setShowMonthwise(v => !v)}
            aria-expanded={showMonthwise}
            aria-controls="sales-page-monthwise-table"
          >
            {showMonthwise ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {showMonthwise && (
      <div id="sales-page-monthwise-table" className="sales-page-table-wrapper" role="region" aria-label="Sales Table">
        <table className="sales-page-table">
          <thead>
            <tr>
              <th>Brand Name</th>
              <th>Category</th>
              <th>Device Sales</th>
              <th>Plan Sales</th>
              <th>Attach %</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading sales data...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'red' }}>
                  {error}
                </td>
              </tr>
            ) : monthwiseSalesData.length > 0 ? (
              monthwiseSalesData.map((item, idx) => (
                <tr key={`${item.brandName}-${item.categoryName}-${idx}`}>
                  <td data-label="Brand Name">{item.brandName}</td>
                  <td data-label="Category">{item.categoryName}</td>
                  <td data-label="Device Sales">{item.deviceSales}</td>
                  <td data-label="Plan Sales">{item.planSales}</td>
                  <td data-label="Attach %">{(item.attachPct * 100).toFixed(1)}%</td>
                  <td data-label="Revenue">{formatCurrency(item.revenue)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                  No sales data found for the selected month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
