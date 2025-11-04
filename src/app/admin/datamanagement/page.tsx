'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, BarChart3, Upload, FileSpreadsheet, ArrowRight, Store, Settings } from 'lucide-react';
import './data-management-dashboard.css';

const DataManagementDashboard = () => {
  return (
    <div className="adm-excel-import-dashboard-container">
      <div className="adm-excel-import-dashboard-content">
        <div className="adm-excel-import-import-options-grid">
          {/* Monthly Sales Import */}
          <Link href="/admin/datamanagement/monthwise" className="adm-excel-import-import-card monthly">
            <div className="adm-excel-import-card-header">
              <div className="adm-excel-import-card-icon monthly">
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </div>
              <div className="adm-excel-import-card-title-section">
                <h2 className="adm-excel-import-card-title">Monthly Sales Import</h2>
                <p className="adm-excel-import-card-subtitle">Monthwise sales data</p>
              </div>
              <ArrowRight className="adm-excel-import-card-arrow" />
            </div>
            
            <p className="adm-excel-import-card-description">
              Import monthly sales data with metrics like device sales, plan sales, 
              attach percentage, and revenue organized by month.
            </p>
            
            <div className="adm-excel-import-feature-list">
              <div className="adm-excel-import-feature-item">
                <FileSpreadsheet className="adm-excel-import-feature-icon monthly" />
                Supports .xlsx and .xls files
              </div>
              <div className="adm-excel-import-feature-item">
                <Upload className="adm-excel-import-feature-icon monthly" />
                Drag & drop interface
              </div>
            </div>
            
            <div className="adm-excel-import-columns-section monthly">
              <h4 className="adm-excel-import-columns-title monthly">Expected Columns:</h4>
              <div className="adm-excel-import-columns-list monthly">
                <p>• Store_ID, Brand, Category</p>
                <p>• Date columns (DD-MM-YYYY format)</p>
                <p>• Device Sales, Plan Sales, Attach %, Revenue</p>
              </div>
            </div>
          </Link>

          {/* Daily Sales Import */}
          <Link href="/admin/datamanagement/datewise" className="adm-excel-import-import-card daily">
            <div className="adm-excel-import-card-header">
              <div className="adm-excel-import-card-icon daily">
                <Calendar className="w-8 h-8 text-green-600" />
              </div>
              <div className="adm-excel-import-card-title-section">
                <h2 className="adm-excel-import-card-title">Daily Sales Import</h2>
                <p className="adm-excel-import-card-subtitle">Datewise sales data</p>
              </div>
              <ArrowRight className="adm-excel-import-card-arrow" />
            </div>
            
            <p className="adm-excel-import-card-description">
              Import daily sales data with daily metrics like count of sales 
              and revenue organized by specific dates.
            </p>
            
            <div className="adm-excel-import-feature-list">
              <div className="adm-excel-import-feature-item">
                <FileSpreadsheet className="adm-excel-import-feature-icon daily" />
                Supports .xlsx and .xls files
              </div>
              <div className="adm-excel-import-feature-item">
                <Upload className="adm-excel-import-feature-icon daily" />
                Drag & drop interface
              </div>
            </div>
            
            <div className="adm-excel-import-columns-section daily">
              <h4 className="adm-excel-import-columns-title daily">Expected Columns:</h4>
              <div className="adm-excel-import-columns-list daily">
                <p>• Store_ID, Brand, Category</p>
                <p>• Date columns (DD-MM-YYYY format)</p>
                <p>• Count of Sales, Revenue</p>
              </div>
            </div>
          </Link>

          {/* Store Import */}
          <Link href="/admin/datamanagement/storewise" className="adm-excel-import-import-card store">
            <div className="adm-excel-import-card-header">
              <div className="adm-excel-import-card-icon store">
                <Store className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="adm-excel-import-card-title-section">
                <h2 className="adm-excel-import-card-title">Stores Import</h2>
                <p className="adm-excel-import-card-subtitle">Store data & assignments</p>
              </div>
              <ArrowRight className="adm-excel-import-card-arrow" />
            </div>
            
            <p className="adm-excel-import-card-description">
              Import store information and manage executive assignments. 
              Add or remove executives from stores efficiently.
            </p>
            
            <div className="adm-excel-import-feature-list">
              <div className="adm-excel-import-feature-item">
                <FileSpreadsheet className="adm-excel-import-feature-icon store" />
                Supports .xlsx and .xls files
              </div>
              <div className="adm-excel-import-feature-item">
                <Upload className="adm-excel-import-feature-icon store" />
                Drag & drop interface
              </div>
            </div>
            
            <div className="adm-excel-import-columns-section store">
              <h4 className="adm-excel-import-columns-title store">Expected Columns:</h4>
              <div className="adm-excel-import-columns-list store">
                <p>• Store_ID, Store Name, City</p>
                <p>• partneraBrandIds (comma-separated)</p>
                <p>• Executive_IDs (comma-separated)</p>
              </div>
            </div>
          </Link>

          {/* User Management */}
          <Link href="/admin/datamanagement/usermanagement" className="adm-excel-import-import-card user-mgmt">
            <div className="adm-excel-import-card-header">
              <div className="adm-excel-import-card-icon user-mgmt">
                <Settings className="w-8 h-8 text-purple-600" />
              </div>
              <div className="adm-excel-import-card-title-section">
                <h2 className="adm-excel-import-card-title">User Management</h2>
                <p className="adm-excel-import-card-subtitle">Create & manage users</p>
              </div>
              <ArrowRight className="adm-excel-import-card-arrow" />
            </div>
            
            <p className="adm-excel-import-card-description">
              Create new Admin and Executive users with automated ID generation. 
              Manage existing users with search and filter capabilities.
            </p>
            
            <div className="adm-excel-import-feature-list">
              <div className="adm-excel-import-feature-item">
                <Settings className="adm-excel-import-feature-icon user-mgmt" />
                Auto ID generation system
              </div>
              <div className="adm-excel-import-feature-item">
                <Upload className="adm-excel-import-feature-icon user-mgmt" />
                Role-based user creation
              </div>
            </div>
            
            <div className="adm-excel-import-columns-section user-mgmt">
              <h4 className="adm-excel-import-columns-title user-mgmt">Features:</h4>
              <div className="adm-excel-import-columns-list user-mgmt">
                <p>• Auto-generate user_00001, admin_00001, executive_00001</p>
                <p>• Search & filter users by name, email, role</p>
                <p>• Secure password hashing and validation</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DataManagementDashboard;
