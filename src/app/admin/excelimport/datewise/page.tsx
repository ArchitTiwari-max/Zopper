'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, X, Download, Calendar } from 'lucide-react';
import './datewise-import.css';

interface ImportResult {
  totalRows: number;
  successful: number;
  failed: number;
  errors: string[];
}

interface ImportStatus {
  isImporting: boolean;
  result: ImportResult | null;
  error: string | null;
}

const DatewiseExcelImport = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    result: null,
    error: null
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setImportStatus({
          isImporting: false,
          result: null,
          error: 'Please upload a valid Excel file (.xlsx or .xls)'
        });
        return;
      }

      setUploadedFile(file);
      setImportStatus({
        isImporting: false,
        result: null,
        error: null
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB max
  });

  const handleImport = async () => {
    if (!uploadedFile) return;

    setImportStatus({
      isImporting: true,
      result: null,
      error: null
    });

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('type', 'daily');

      const response = await fetch('/api/admin/excel-import-stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start import stream');
      }

      console.log('📨 Connected to streaming import');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('🏁 Stream completed');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === 'progress') {
                  if (data.message) {
                    console.log(data.message);
                  }
                  
                  if (data.rowData) {
                    const { Store_ID, Brand, Category, status, message } = data.rowData;
                    const icon = status === 'success' ? '✅' : '❌';
                    
                    console.log(`${icon} Row ${data.currentRow}/${data.totalRows}: ${Store_ID} | ${Brand} | ${Category}`);
                    if (message && message !== 'Total successful:') {
                      console.log(`   └─ ${message}`);
                    }
                  }
                } else if (data.type === 'complete') {
                  console.log('🎉 Import completed successfully!');
                  console.log(`📈 Total rows processed: ${data.summary.totalRows}`);
                  console.log(`✅ Successful imports: ${data.summary.successful}`);
                  
                  if (data.summary.failed > 0) {
                    console.log(`⚠️ Failed imports: ${data.summary.failed}`);
                    
                    // Show first few errors
                    data.summary.errors.slice(0, 5).forEach(error => {
                      console.log(`   └─ ${error}`);
                    });
                  }

                  setImportStatus({
                    isImporting: false,
                    result: data.summary,
                    error: null
                  });

                  setUploadedFile(null);
                  console.log('🧹 Cleared uploaded file');
                } else if (data.type === 'error') {
                  throw new Error(data.message);
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            }
          }
        }
      }
      
    } catch (error) {
      setImportStatus({
        isImporting: false,
        result: null,
        error: error instanceof Error ? error.message : 'Import failed'
      });
    }
  };

  const downloadTemplate = () => {
    // Create a link to download the template
    const link = document.createElement('a');
    link.href = '/templates/daily-sales-template.xlsx';
    link.download = 'daily-sales-template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFile = () => {
    setUploadedFile(null);
    setImportStatus({
      isImporting: false,
      result: null,
      error: null
    });
  };

  return (
    <div className="import-container daily-import-theme">
      <div className="import-card">
        <div className="import-header">
          <div className="header-content">
            <Calendar className="header-icon" />
            <div>
              <h1 className="import-title">Daily Sales Data Import</h1>
              <p className="import-subtitle">Datewise sales data import</p>
            </div>
          </div>
          <p className="import-description">
            Upload Excel files with daily sales data. The file should contain Store_ID, Brand, Category, 
            and date columns with metrics like Count of Sales and Revenue.
          </p>
        </div>

        {/* Template Download */}
        <div className="template-section">
          <div className="template-content">
            <div className="template-info">
              <h3>Need a template?</h3>
              <p>Download the Excel template to see the expected format for daily data</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="template-button"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="upload-section">
          <div
            {...getRootProps()}
            className={`upload-area ${
              isDragActive ? 'drag-active' : ''
            } ${uploadedFile ? 'file-uploaded' : ''}`}
          >
            <input {...getInputProps()} />
            
            {uploadedFile ? (
              <div className="file-info">
                <FileText className="w-8 h-8 text-green-600" />
                <div className="file-details">
                  <p className="file-name">{uploadedFile.name}</p>
                  <p className="file-size">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="clear-file-button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="upload-icon" />
                {isDragActive ? (
                  <p className="drag-active-text">Drop the Excel file here...</p>
                ) : (
                  <div>
                    <p className="upload-text-primary">
                      Drag and drop your Excel file here
                    </p>
                    <p className="upload-text-secondary">or click to browse</p>
                    <p className="upload-text-info">
                      Supports .xlsx and .xls files up to 10MB
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Import Button */}
        {uploadedFile && (
          <div className="import-button-section">
            <button
              onClick={handleImport}
              disabled={importStatus.isImporting}
              className="import-button"
            >
              {importStatus.isImporting ? (
                <>
                  <div className="spinner"></div>
                  Processing Import...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Import Daily Sales Data
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Display */}
        {importStatus.error && (
          <div className="error-message">
            <div className="error-content">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
              <div>
                <h3 className="error-title">Import Failed</h3>
                <p className="error-text">{importStatus.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success/Results Display */}
        {importStatus.result && (
          <div className="success-message">
            <div className="success-content">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
              <div className="flex-1">
                <h3 className="success-title">Import Completed</h3>
                
                <div className="results-grid">
                  <div className="result-card">
                    <div className="result-number">
                      {importStatus.result.totalRows}
                    </div>
                    <div className="result-label">Total Rows</div>
                  </div>
                  <div className="result-card">
                    <div className="result-number success">
                      {importStatus.result.successful}
                    </div>
                    <div className="result-label">Successful</div>
                  </div>
                  <div className="result-card">
                    <div className="result-number error">
                      {importStatus.result.failed}
                    </div>
                    <div className="result-label">Failed</div>
                  </div>
                </div>

                {importStatus.result.errors.length > 0 && (
                  <div>
                    <h4 className="error-title">Error Details:</h4>
                    <div className="error-details">
                      {importStatus.result.errors.map((error, index) => (
                        <div key={index} className="error-item">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Format Information */}
        <div className="format-info">
          <h3 className="format-title">Expected Excel Format for Daily Sales:</h3>
          <div className="format-list">
            <p>• <strong>Required columns:</strong> Store_ID, Brand, Category</p>
            <p>• <strong>Date columns:</strong> Format as DD-MM-YYYY (e.g., 01-01-2024)</p>
            <p>• <strong>Daily Metrics:</strong> Count of Sales, Revenue</p>
            <p>• <strong>Header structure:</strong> Two-row headers with dates and metrics</p>
            <p>• <strong>Data rows:</strong> Start from row 3 onwards</p>
            <p>• <strong>Note:</strong> This imports daily/datewise sales data only</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatewiseExcelImport;