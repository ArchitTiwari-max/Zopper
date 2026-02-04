'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Database, Calendar, Filter, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import './dump-import.css';

// Brand configuration with their expected columns
const BRAND_COLUMNS = {
    Godrej: [
        'Warranty Activation Code',
        'Customer Premium',
        'Zopper Plan Duration',
        'Warranty Purchase Date',
        'Warranty Start Date',
        'Technician_UserID',
        'Technician_Name',
        'Service_Centre_Name',
        'Business Name',
        'PinCode',
        'Customer_City',
        'Customer_State',
        'Product Purchased Date',
        'Appliance Model Name',
        'Product_Category_ID',
        'Model Code',
        'Product_Category',
        'Product_Coverage',
        'Product_Serial_Number',
        'Branch',
        'POC Name',
        'Channel'
    ],
    Samsung: [], // To be defined later
    Havells: []  // To be defined later
};

interface DumpData {
    [key: string]: string | null;
}

const DumpImportPage = () => {
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [uploadedData, setUploadedData] = useState<DumpData[]>([]);
    const [filteredData, setFilteredData] = useState<DumpData[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | '', message: string }>({ type: '', message: '' });
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [allDumps, setAllDumps] = useState<any[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    // Fetch dumps from database
    const fetchDumps = async (brand: string, date?: string) => {
        try {
            const params = new URLSearchParams({ brand });
            if (date) params.append('date', date);

            const response = await fetch(`/api/admin/dump-import?${params}`);
            const data = await response.json();

            if (data.success) {
                setAllDumps(data.dumps);

                if (!date) {
                    // Extract unique dates when fetching all dumps
                    const uniqueDates = extractUniqueDates(data.dumps);
                    setAvailableDates(uniqueDates);
                    setFilteredData(data.dumps);
                } else {
                    setFilteredData(data.dumps);
                }
            }
        } catch (error) {
            console.error('Error fetching dumps:', error);
        }
    };

    // Extract unique upload dates from dumps
    const extractUniqueDates = (dumps: any[]) => {
        const dates = dumps.map(dump => {
            const date = new Date(dump.uploadedAt);
            return date.toISOString().split('T')[0]; // YYYY-MM-DD format
        });
        return [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    };

    // Format date for display (e.g., "04 Mar", "16 March")
    const formatDateDisplay = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        return `${day} ${month}`;
    };

    // Handle brand selection
    const handleBrandChange = (brand: string) => {
        setSelectedBrand(brand);
        setUploadedData([]);
        setFilteredData([]);
        setSelectedDate('');
        setAvailableDates([]);
        setUploadStatus({ type: '', message: '' });
        if (brand) {
            fetchDumps(brand);
        }
    };

    // Handle date filter
    const handleDateFilter = (date: string) => {
        setSelectedDate(date);
        if (date) {
            fetchDumps(selectedBrand, date);
        } else {
            fetchDumps(selectedBrand);
        }
    };

    // Handle file drop
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!selectedBrand) {
            setUploadStatus({ type: 'error', message: 'Please select a brand first!' });
            return;
        }

        const file = acceptedFiles[0];
        if (!file) return;

        setIsUploading(true);
        setUploadStatus({ type: '', message: '' });

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // Check if file has data
            if (!jsonData || jsonData.length === 0) {
                setUploadStatus({
                    type: 'error',
                    message: 'Excel file is empty or has no data'
                });
                setIsUploading(false);
                return;
            }


            // Upload to server
            const response = await fetch('/api/admin/dump-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brand: selectedBrand,
                    data: jsonData
                })
            });

            const result = await response.json();

            if (result.success) {
                setUploadStatus({
                    type: 'success',
                    message: `Successfully uploaded ${result.count} records!`
                });
                setUploadedData(jsonData as DumpData[]);
                // Refresh the data
                fetchDumps(selectedBrand);
            } else {
                setUploadStatus({ type: 'error', message: result.error || 'Upload failed' });
            }
        } catch (error) {
            setUploadStatus({ type: 'error', message: 'Error processing file' });
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    }, [selectedBrand]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        multiple: false,
        disabled: !selectedBrand
    });

    const getTableColumns = () => {
        if (filteredData.length > 0) {
            return Object.keys(filteredData[0]).filter(key => key !== 'id' && key !== 'uploadedAt' && key !== 'brandName');
        }
        return BRAND_COLUMNS[selectedBrand as keyof typeof BRAND_COLUMNS] || [];
    };

    return (
        <div className="dump-import-container">
            <div className="dump-import-header">
                <div className="dump-import-title-section">
                    <Database className="dump-import-header-icon" />
                    <div>
                        <h1 className="dump-import-title">Dump Import</h1>
                        <p className="dump-import-subtitle">Import and manage brand dump data</p>
                    </div>
                </div>
            </div>

            {/* Brand Selection */}
            <div className="dump-import-card">
                <h2 className="dump-import-section-title">Select Brand</h2>
                <div className="dump-import-brand-grid">
                    {Object.keys(BRAND_COLUMNS).map((brand) => (
                        <button
                            key={brand}
                            onClick={() => handleBrandChange(brand)}
                            className={`dump-import-brand-btn ${selectedBrand === brand ? 'active' : ''}`}
                        >
                            {brand}
                        </button>
                    ))}
                </div>
            </div>

            {/* Upload Section */}
            {selectedBrand && (
                <div className="dump-import-card">
                    <h2 className="dump-import-section-title">Upload Excel File</h2>
                    <div
                        {...getRootProps()}
                        className={`dump-import-dropzone ${isDragActive ? 'active' : ''} ${!selectedBrand ? 'disabled' : ''}`}
                    >
                        <input {...getInputProps()} />
                        {isUploading ? (
                            <div className="dump-import-upload-status">
                                <Loader2 className="dump-import-spinner" />
                                <p>Uploading...</p>
                            </div>
                        ) : (
                            <>
                                <Upload className="dump-import-upload-icon" />
                                <p className="dump-import-dropzone-text">
                                    {isDragActive
                                        ? 'Drop the Excel file here'
                                        : 'Drag & drop an Excel file here, or click to select'}
                                </p>
                                <p className="dump-import-dropzone-subtext">Supports .xlsx and .xls files</p>
                            </>
                        )}
                    </div>

                    {uploadStatus.message && (
                        <div className={`dump-import-status-message ${uploadStatus.type}`}>
                            {uploadStatus.message}
                        </div>
                    )}
                </div>
            )}

            {/* Date Filter */}
            {selectedBrand && availableDates.length > 0 && (
                <div className="dump-import-card">
                    <div className="dump-import-filter-header">
                        <Calendar className="dump-import-filter-icon" />
                        <label className="dump-import-filter-label">Filter by Upload Date:</label>
                    </div>
                    <div className="dump-import-filter-controls">
                        <select
                            value={selectedDate}
                            onChange={(e) => handleDateFilter(e.target.value)}
                            className="dump-import-date-select"
                        >
                            <option value="">All Dates ({allDumps.length} records)</option>
                            {availableDates.map((date) => {
                                const count = allDumps.filter(dump => {
                                    const dumpDate = new Date(dump.uploadedAt).toISOString().split('T')[0];
                                    return dumpDate === date;
                                }).length;
                                return (
                                    <option key={date} value={date}>
                                        {formatDateDisplay(date)} ({count} records)
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
            )}

            {/* Data Table */}
            {selectedBrand && filteredData.length > 0 && (
                <div className="dump-import-card">
                    <div className="dump-import-table-header">
                        <h2 className="dump-import-section-title">
                            {selectedBrand} Dump Data ({filteredData.length} records)
                        </h2>
                    </div>
                    <div className="dump-import-table-wrapper">
                        <table className="dump-import-table">
                            <thead>
                                <tr>
                                    <th className="dump-import-table-th">#</th>
                                    {getTableColumns().map((column) => (
                                        <th key={column} className="dump-import-table-th">
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((row, index) => (
                                    <tr key={index} className="dump-import-table-tr">
                                        <td className="dump-import-table-td">{index + 1}</td>
                                        {getTableColumns().map((column) => (
                                            <td key={column} className="dump-import-table-td">
                                                {row[column] || '-'}
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
            {selectedBrand && filteredData.length === 0 && !isUploading && (
                <div className="dump-import-empty-state">
                    <Database className="dump-import-empty-icon" />
                    <p className="dump-import-empty-text">No dump data found for {selectedBrand}</p>
                    <p className="dump-import-empty-subtext">Upload an Excel file to get started</p>
                </div>
            )}
        </div>
    );
};

export default DumpImportPage;
