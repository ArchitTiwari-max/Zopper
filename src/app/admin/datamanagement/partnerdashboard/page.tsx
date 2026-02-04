'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Package, Loader2, Database, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import './partner-dashboard.css';

// Brand configuration
const BRANDS = ['Godrej', 'Samsung', 'Havells'];

// Channel names
const CHANNELS = ['D2D', 'POD', 'POS', 'Telecaller'];

// Product categories - now loaded dynamically from data

interface ChannelStats {
    sum: number;
    count: number;
}

interface CategoryStats {
    sum: number;
    count: number;
}

interface DashboardData {
    totalSales: number;
    channelStats: Record<string, ChannelStats>;
    categoryStats: Record<string, CategoryStats>;
    records: any[];
    totalRecords: number;
    availableCategories: string[];
    availablePocNames: string[];
}

const PartnerDashboard = () => {
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedChannel, setSelectedChannel] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedPocName, setSelectedPocName] = useState<string>('');
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch dashboard data
    const fetchDashboardData = async () => {
        if (!selectedBrand) return;

        setIsLoading(true);
        try {
            const params = new URLSearchParams({ brand: selectedBrand });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (selectedChannel) params.append('channel', selectedChannel);
            if (selectedCategory) params.append('category', selectedCategory);
            if (selectedPocName) params.append('pocName', selectedPocName);

            const response = await fetch(`/api/admin/partner-dashboard?${params}`);
            const result = await response.json();

            if (result.success) {
                setDashboardData(result.data);
            } else {
                console.error('Error fetching data:', result.error);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch data when brand, date range, or filters change
    useEffect(() => {
        fetchDashboardData();
    }, [selectedBrand, startDate, endDate, selectedChannel, selectedCategory, selectedPocName]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    };

    // Export to Excel
    const exportToExcel = () => {
        if (!dashboardData || dashboardData.records.length === 0) {
            alert('No data to export');
            return;
        }

        // Get column headers
        const columns = getTableColumns();

        // Prepare data for Excel
        const excelData = dashboardData.records.map(record => {
            const row: any = {};
            columns.forEach(column => {
                row[column] = record[column] !== null && record[column] !== undefined
                    ? record[column]
                    : '';
            });
            return row;
        });

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Data');

        // Auto-size columns
        const maxWidth = 50;
        const colWidths = columns.map(column => {
            const maxLength = Math.max(
                column.length,
                ...excelData.map(row => String(row[column] || '').length)
            );
            return { wch: Math.min(maxLength + 2, maxWidth) };
        });
        worksheet['!cols'] = colWidths;

        // Generate filename with filters
        const filters = [];
        if (selectedBrand) filters.push(selectedBrand);
        if (startDate) filters.push(`from-${startDate}`);
        if (endDate) filters.push(`to-${endDate}`);
        if (selectedChannel) filters.push(selectedChannel);
        if (selectedCategory) filters.push(selectedCategory);
        if (selectedPocName) filters.push(selectedPocName);

        const filename = `${filters.join('_')}_sales_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Write and download
        XLSX.writeFile(workbook, filename);
    };

    // Get table columns
    const getTableColumns = () => {
        if (dashboardData && dashboardData.records.length > 0) {
            return Object.keys(dashboardData.records[0]).filter(
                key => key !== 'id' && key !== 'brandName' && key !== 'additionalData'
            );
        }
        return [];
    };

    return (
        <div className="partner-dashboard-container">
            {/* Filters */}
            <div className="partner-dashboard-filters">
                <div className="partner-dashboard-filters-grid">
                    {/* Brand Selection */}
                    <div className="partner-dashboard-filter-group">
                        <label className="partner-dashboard-filter-label">Select Brand</label>
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="partner-dashboard-filter-select"
                        >
                            <option value="">Choose a brand...</option>
                            {BRANDS.map((brand) => (
                                <option key={brand} value={brand}>
                                    {brand}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* From Date Filter */}
                    <div className="partner-dashboard-filter-group">
                        <label className="partner-dashboard-filter-label">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="partner-dashboard-filter-select"
                            disabled={!selectedBrand}
                        />
                    </div>

                    {/* To Date Filter */}
                    <div className="partner-dashboard-filter-group">
                        <label className="partner-dashboard-filter-label">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="partner-dashboard-filter-select"
                            disabled={!selectedBrand}
                        />
                    </div>

                    {/* Channel Filter */}
                    <div className="partner-dashboard-filter-group">
                        <label className="partner-dashboard-filter-label">Filter by Channel</label>
                        <select
                            value={selectedChannel}
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="partner-dashboard-filter-select"
                            disabled={!selectedBrand}
                        >
                            <option value="">All Channels</option>
                            {CHANNELS.map((channel) => (
                                <option key={channel} value={channel}>
                                    {channel}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Product Category Filter */}
                    <div className="partner-dashboard-filter-group">
                        <label className="partner-dashboard-filter-label">Filter by Category</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="partner-dashboard-filter-select"
                            disabled={!selectedBrand || !dashboardData}
                        >
                            <option value="">All Categories</option>
                            {dashboardData?.availableCategories?.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Executive (POC Name) Filter */}
                    <div className="partner-dashboard-filter-group">
                        <label className="partner-dashboard-filter-label">Filter by Executive</label>
                        <select
                            value={selectedPocName}
                            onChange={(e) => setSelectedPocName(e.target.value)}
                            className="partner-dashboard-filter-select"
                            disabled={!selectedBrand || !dashboardData}
                        >
                            <option value="">All Executives</option>
                            {dashboardData?.availablePocNames?.map((pocName) => (
                                <option key={pocName} value={pocName}>
                                    {pocName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="partner-dashboard-loading">
                    <Loader2 className="partner-dashboard-spinner" />
                    <p>Loading dashboard data...</p>
                </div>
            )}

            {/* Dashboard Content */}
            {!isLoading && selectedBrand && dashboardData && (
                <>
                    {/* Stats Tiles */}
                    <div className="partner-dashboard-stats-grid">
                        {/* Total Sales Tile */}
                        <div className="partner-dashboard-stat-tile total-sales">
                            <div className="partner-dashboard-stat-header">
                                <div className="partner-dashboard-stat-icon purple">
                                    <TrendingUp size={24} />
                                </div>
                                <h3 className="partner-dashboard-stat-title">Total Sales</h3>
                            </div>
                            <div className="partner-dashboard-stat-value">
                                {formatCurrency(dashboardData.totalSales)}
                            </div>
                        </div>

                        {/* Channels Tile */}
                        <div className="partner-dashboard-stat-tile channels">
                            <div className="partner-dashboard-stat-header">
                                <div className="partner-dashboard-stat-icon green">
                                    <Users size={24} />
                                </div>
                                <h3 className="partner-dashboard-stat-title">Channels</h3>
                            </div>
                            <div className="partner-dashboard-breakdown">
                                {CHANNELS.map((channel) => {
                                    const stats = dashboardData.channelStats[channel] || { sum: 0, count: 0 };
                                    return (
                                        <div key={channel} className="partner-dashboard-breakdown-item">
                                            <span className="partner-dashboard-breakdown-label">{channel}</span>
                                            <span className="partner-dashboard-breakdown-value">
                                                {formatCurrency(stats.sum)}
                                                <span className="partner-dashboard-breakdown-count">
                                                    ({stats.count} units)
                                                </span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Product Categories Tile */}
                        <div className="partner-dashboard-stat-tile categories">
                            <div className="partner-dashboard-stat-header">
                                <div className="partner-dashboard-stat-icon blue">
                                    <Package size={24} />
                                </div>
                                <h3 className="partner-dashboard-stat-title">Product Category</h3>
                            </div>
                            <div className="partner-dashboard-breakdown">
                                {dashboardData.availableCategories?.map((category: string) => {
                                    const stats = dashboardData.categoryStats[category] || { sum: 0, count: 0 };
                                    return (
                                        <div key={category} className="partner-dashboard-breakdown-item">
                                            <span className="partner-dashboard-breakdown-label">{category}</span>
                                            <span className="partner-dashboard-breakdown-value">
                                                {stats.count} units | {formatCurrency(stats.sum)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    {dashboardData.records.length > 0 && (
                        <div className="partner-dashboard-table-section">
                            <div className="partner-dashboard-table-header">
                                <div>
                                    <h2 className="partner-dashboard-table-title">
                                        {selectedBrand} Sales Data
                                    </h2>
                                    <span className="partner-dashboard-table-count">
                                        {dashboardData.totalRecords} records
                                    </span>
                                </div>
                                <button
                                    onClick={exportToExcel}
                                    className="partner-dashboard-export-btn"
                                    title="Export to Excel"
                                >
                                    <Download size={18} />
                                    Export to Excel
                                </button>
                            </div>
                            <div className="partner-dashboard-table-wrapper">
                                <table className="partner-dashboard-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            {getTableColumns().map((column) => (
                                                <th key={column}>{column}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dashboardData.records.map((record, index) => (
                                            <tr key={record.id || index}>
                                                <td>{index + 1}</td>
                                                {getTableColumns().map((column) => (
                                                    <td key={column}>
                                                        {record[column] !== null && record[column] !== undefined
                                                            ? String(record[column])
                                                            : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {dashboardData.records.length === 0 && (
                        <div className="partner-dashboard-empty">
                            <Database className="partner-dashboard-empty-icon" />
                            <p className="partner-dashboard-empty-text">No data found</p>
                            <p className="partner-dashboard-empty-subtext">
                                No sales data available for {selectedBrand} with the selected filters
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Initial State - No Brand Selected */}
            {!selectedBrand && !isLoading && (
                <div className="partner-dashboard-empty">
                    <Database className="partner-dashboard-empty-icon" />
                    <p className="partner-dashboard-empty-text">Select a brand to view dashboard</p>
                    <p className="partner-dashboard-empty-subtext">
                        Choose a brand from the dropdown above to see sales analytics
                    </p>
                </div>
            )}
        </div>
    );
};

export default PartnerDashboard;
