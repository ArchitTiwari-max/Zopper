'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, BarChart3, Upload, FileSpreadsheet, ArrowRight } from 'lucide-react';
import './excel-import-dashboard.css';

const ExcelImportDashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="import-options-grid">
          {/* Monthly Sales Import */}
          <Link href="/admin/excelimport/monthwise" className="import-card monthly">
            <div className="card-header">
              <div className="card-icon monthly">
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </div>
              <div className="card-title-section">
                <h2 className="card-title">Monthly Sales Import</h2>
                <p className="card-subtitle">Monthwise sales data</p>
              </div>
              <ArrowRight className="card-arrow" />
            </div>
            
            <p className="card-description">
              Import monthly sales data with metrics like device sales, plan sales, 
              attach percentage, and revenue organized by month.
            </p>
            
            <div className="feature-list">
              <div className="feature-item">
                <FileSpreadsheet className="feature-icon monthly" />
                Supports .xlsx and .xls files
              </div>
              <div className="feature-item">
                <Upload className="feature-icon monthly" />
                Drag & drop interface
              </div>
            </div>
            
            <div className="columns-section monthly">
              <h4 className="columns-title monthly">Expected Columns:</h4>
              <div className="columns-list monthly">
                <p>• Store_ID, Brand, Category</p>
                <p>• Date columns (DD-MM-YYYY format)</p>
                <p>• Device Sales, Plan Sales, Attach %, Revenue</p>
              </div>
            </div>
          </Link>

          {/* Daily Sales Import */}
          <Link href="/admin/excelimport/datewise" className="import-card daily">
            <div className="card-header">
              <div className="card-icon daily">
                <Calendar className="w-8 h-8 text-green-600" />
              </div>
              <div className="card-title-section">
                <h2 className="card-title">Daily Sales Import</h2>
                <p className="card-subtitle">Datewise sales data</p>
              </div>
              <ArrowRight className="card-arrow" />
            </div>
            
            <p className="card-description">
              Import daily sales data with daily metrics like count of sales 
              and revenue organized by specific dates.
            </p>
            
            <div className="feature-list">
              <div className="feature-item">
                <FileSpreadsheet className="feature-icon daily" />
                Supports .xlsx and .xls files
              </div>
              <div className="feature-item">
                <Upload className="feature-icon daily" />
                Drag & drop interface
              </div>
            </div>
            
            <div className="columns-section daily">
              <h4 className="columns-title daily">Expected Columns:</h4>
              <div className="columns-list daily">
                <p>• Store_ID, Brand, Category</p>
                <p>• Date columns (DD-MM-YYYY format)</p>
                <p>• Count of Sales, Revenue</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Instructions Section */}
        <div className="instructions-section">
          <h3 className="instructions-title">Import Instructions</h3>
          
          <div className="instructions-grid">
            <div className="instruction-section">
              <h4>Before You Start:</h4>
              <div className="instruction-list">
                <p>• Ensure your Excel file has the correct format</p>
                <p>• Check that Store_ID exists in the system</p>
                <p>• Verify Brand and Category mappings</p>
                <p>• Use DD-MM-YYYY date format</p>
                <p>• Keep file size under 10MB</p>
              </div>
            </div>
            
            <div className="instruction-section">
              <h4>File Structure:</h4>
              <div className="instruction-list">
                <p>• Row 1: Date headers or field names</p>
                <p>• Row 2: Metric names (sub-headers)</p>
                <p>• Row 3+: Data rows</p>
                <p>• Two-row header structure required</p>
                <p>• Data should start from row 3</p>
              </div>
            </div>
          </div>
          
          <div className="warning-section">
            <div className="warning-content">
              <div className="warning-icon">⚠️</div>
              <div>
                <h4 className="warning-title">Important Notes:</h4>
                <div className="warning-text">
                  <p>• Make sure all referenced stores, brands, and categories exist in the system before importing</p>
                  <p>• The import process will validate all relationships and provide detailed error reports</p>
                  <p>• Large files may take several minutes to process</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportDashboard;