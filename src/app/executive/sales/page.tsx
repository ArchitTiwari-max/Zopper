'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import './Sales.css';

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
  const [brand, setBrand] = useState<'Samsung' | 'Godrej' | 'Havells'>('Samsung');

  // Section toggles
  const [showDatewise, setShowDatewise] = useState(true);
  const [showMonthwise, setShowMonthwise] = useState(true);

  const searchParams = useSearchParams();
  const storeName = useMemo(() => {
    const raw = searchParams.get('store');
    return raw ? decodeURIComponent(raw) : 'My Store';
  }, [searchParams]);


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
      <section className="sales-page-datewise-section" aria-label="Date wise sales of latest month">
        <div className="sales-page-monthbar">
          <h2 className="sales-page-month-title">{currentMonthLabel}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="sales-page-month-select">
              <label htmlFor="brand" className="sales-page-visually-hidden">Select Brand</label>
              <select id="brand" value={brand} onChange={(e) => setBrand(e.target.value as any)} aria-label="Select Brand">
                <option value="Samsung">Samsung</option>
                <option value="Godrej">Godrej</option>
                <option value="Havells">Havells</option>
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
                <th>Device Sales</th>
                <th>Plan Sales</th>
                <th>Attach %</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const now = new Date();
                const days = getDaysInMonth(now.getFullYear(), now.getMonth());
                const rowsEls: React.ReactNode[] = [];
                for (let day = 1; day <= days; day++) {
                  const date = new Date(now.getFullYear(), now.getMonth(), day);
                  const dateStr = formatDateDDMMYYYY(date);
                  dateCategories.forEach((cat, idx) => {
                    rowsEls.push(
                      <tr key={`date-${dateStr}-${cat}`}>
                        {idx === 0 && (
                          <td rowSpan={dateCategories.length} data-label="Date">{dateStr}</td>
                        )}
                        <td data-label="Category">{cat}</td>
                        <td data-label="Device Sales"></td>
                        <td data-label="Plan Sales"></td>
                        <td data-label="Attach %"></td>
                        <td data-label="Revenue"></td>
                      </tr>
                    );
                  });
                }
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
            {rows.map((r, idx) => (
              <tr key={`${r.brand}-${r.category}-${idx}`}>
                <td data-label="Brand Name">{r.brand}</td>
                <td data-label="Category">{r.category}</td>
                <td data-label="Device Sales"></td>
                <td data-label="Plan Sales"></td>
                <td data-label="Attach %"></td>
                <td data-label="Revenue"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
