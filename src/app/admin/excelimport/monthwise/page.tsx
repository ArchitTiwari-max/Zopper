'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, X, Download, Terminal, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import './monthwise-import.css';

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

interface ConsoleLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

const MonthwiseExcelImport = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    result: null,
    error: null
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [progressData, setProgressData] = useState<{ current: number; total: number } | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (consoleEndRef.current && showConsole) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, showConsole]);

  // Helper function to add console logs
  const addConsoleLog = (type: ConsoleLog['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog: ConsoleLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      type,
      message
    };
    setConsoleLogs(prev => [...prev, newLog]);
    
    // Also log to browser console for debugging
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
  };

  // Clear console logs
  const clearConsole = () => {
    setConsoleLogs([]);
  };
  
  // Helper function to filter out internal/technical messages
  const isInternalMessage = (message: string): boolean => {
    const internalKeywords = [
      'Initializing performance cache',
      'Cache initialized - 10x performance boost',
      'Parsing Excel file',
      'File structure:',
      'Starting row-by-row processing',
      'Writing', 'validated records to database',
      'Starting monthly batch processing',
      'Starting daily batch processing',
      'Batch processing complete:',
      'Processing completed in'
    ];
    
    return internalKeywords.some(keyword => message.includes(keyword));
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      addConsoleLog('info', `📁 File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Validate file type
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        addConsoleLog('error', '❌ Invalid file type. Please upload a valid Excel file (.xlsx or .xls)');
        setImportStatus({
          isImporting: false,
          result: null,
          error: 'Please upload a valid Excel file (.xlsx or .xls)'
        });
        return;
      }

      addConsoleLog('success', '✅ File validation passed');
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
    if (!uploadedFile) {
      addConsoleLog('error', '❌ No file selected for import');
      return;
    }

    // Show console automatically when import starts
    setShowConsole(true);
    addConsoleLog('info', '🚀 Starting import process...');
    addConsoleLog('info', `📊 Processing file: ${uploadedFile.name}`);

    setImportStatus({
      isImporting: true,
      result: null,
      error: null
    });

    try {
      addConsoleLog('info', '📤 Uploading file to server...');
      
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('type', 'monthly');

      // Set a dynamic timeout based on file size (larger files need more time)
      const fileSize = uploadedFile.size / (1024 * 1024); // Size in MB
      const timeoutDuration = Math.max(60000, fileSize * 10000); // At least 60s, +10s per MB
      
      const timeoutId = setTimeout(() => {
        addConsoleLog('info', `🔄 Processing large file (${fileSize.toFixed(1)} MB) - this may take a few minutes...`);
      }, timeoutDuration);

      const response = await fetch('/api/admin/excel-import-stream-optimized', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start import stream');
      }

      addConsoleLog('info', '📨 Connected to streaming import');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            addConsoleLog('info', '🏁 Stream completed');
            // Ensure loading state is cleared when stream ends
            setImportStatus(prev => ({
              ...prev,
              isImporting: false
            }));
            setProgressData(null);
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
                  // Only show user-relevant messages, filter out technical details
                  if (data.message && !isInternalMessage(data.message)) {
                    addConsoleLog('info', data.message);
                  }
                  
                  if (data.rowData) {
                    const { Store_ID, Brand, Category, status, message } = data.rowData;
                    const icon = status === 'success' ? '✅' : '❌';
                    const logType = status === 'success' ? 'success' : 'error';
                    
                    addConsoleLog(logType, `${icon} Row ${data.currentRow}/${data.totalRows}: ${Store_ID} | ${Brand} | ${Category}`);
                    if (message && message !== 'Total stores pushed:') {
                      addConsoleLog(logType === 'success' ? 'info' : 'error', `   └─ ${message}`);
                    }
                  }
                  
                  if (data.currentRow && data.totalRows) {
                    setProgressData({
                      current: data.currentRow,
                      total: data.totalRows
                    });
                  }
                } else if (data.type === 'complete') {
                  addConsoleLog('success', '🎉 Import completed successfully!');
                  
                  // Show user-friendly summary
                  const processingTime = data.summary.processingTime || 'N/A';
                  addConsoleLog('info', `✅ ${data.summary.successful} of ${data.summary.totalRows} records imported successfully in ${processingTime}`);
                  
                  if (data.summary.failed > 0) {
                    addConsoleLog('warning', `⚠️ ${data.summary.failed} records failed to import`);
                    
                    // Show first few errors
                    data.summary.errors.slice(0, 3).forEach(error => {
                      addConsoleLog('error', `   └─ ${error.replace(/❌ /g, '')}`);
                    });
                    
                    if (data.summary.errors.length > 3) {
                      addConsoleLog('info', `   └─ ... and ${data.summary.errors.length - 3} more errors`);
                    }
                  }

                  setImportStatus({
                    isImporting: false,
                    result: data.summary,
                    error: null
                  });

                  setUploadedFile(null);
                  addConsoleLog('info', '🧹 Cleared uploaded file');
                  setProgressData(null);
                } else if (data.type === 'error') {
                  throw new Error(data.message);
                }
              } catch (parseError) {
                // Silently ignore minor SSE parsing errors that don't affect functionality
                console.debug('Minor SSE parsing error (ignored):', parseError);
              }
            }
          }
        }
      }
      
      // Clear the timeout when processing completes normally
      clearTimeout(timeoutId);
      
    } catch (error) {
      // Clear the timeout on error
      clearTimeout(timeoutId);
      
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      addConsoleLog('error', `❌ Import failed: ${errorMessage}`);
      
      setImportStatus({
        isImporting: false,
        result: null,
        error: errorMessage
      });
    } finally {
      // Ensure loading state is always cleared
      setImportStatus(prev => ({
        ...prev,
        isImporting: false
      }));
      setProgressData(null);
    }
  };

  const downloadTemplate = () => {
    // Create a link to download the template
    const link = document.createElement('a');
    link.href = '/templates/monthly-sales-template.xlsx';
    link.download = 'monthly-sales-template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFile = () => {
    addConsoleLog('info', '🗑️ File cleared by user');
    setUploadedFile(null);
    setImportStatus({
      isImporting: false,
      result: null,
      error: null
    });
  };

  return (
    <div className="import-container">
      <div className="import-card">
        {/* Back Button */}
        <div className="back-button-section">
          <Link href="/admin/excelimport" className="back-button">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Excel Import Dashboard
          </Link>
        </div>
        
        <div className="import-header">
          <h1 className="import-title">Monthly Sales Data Import</h1>
          <p className="import-description">
            Upload Excel files with monthly sales data. The file should contain Store_ID, Brand, Category, 
            and date columns with metrics like device sales, plan sales, attach %, and revenue.
          </p>
        </div>

        {/* Template Download */}
        <div className="template-section">
          <div className="template-content">
            <div className="template-info">
              <h3>Need a template?</h3>
              <p>Download the Excel template to see the expected format</p>
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
                  <p className="upload-text-primary">Drop the Excel file here...</p>
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
                  Import Monthly Sales Data
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

        {/* Console Activity Log */}
        <div className="console-section">
          <div className="console-header">
            <div className="console-header-left">
              <Terminal className="w-5 h-5 mr-2" />
              <h3 className="console-title">Activity Log</h3>
              <span className="console-count">({consoleLogs.length})</span>
            </div>
            <div className="console-header-right">
              {consoleLogs.length > 0 && (
                <button
                  onClick={clearConsole}
                  className="console-clear-button"
                  title="Clear logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowConsole(!showConsole)}
                className="console-toggle-button"
              >
                {showConsole ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          {progressData && importStatus.isImporting && (
            <div className="console-progress">
              <div className="progress-info">
                <span className="progress-text">
                  Processing row {progressData.current} of {progressData.total}
                </span>
                <span className="progress-percentage">
                  {Math.round((progressData.current / progressData.total) * 100)}%
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${(progressData.current / progressData.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {showConsole && (
            <div className="console-body">
              {consoleLogs.length === 0 ? (
                <div className="console-empty">
                  <Terminal className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="console-empty-text">No activity yet. Upload and import a file to see logs.</p>
                </div>
              ) : (
                <div className="console-logs">
                  {consoleLogs.map((log) => (
                    <div key={log.id} className={`console-log console-log-${log.type}`}>
                      <span className="console-timestamp">[{log.timestamp}]</span>
                      <span className="console-message">{log.message}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Format Information */}
        <div className="format-info">
          <h3 className="format-title">Expected Excel Format:</h3>
          <div className="format-list">
            <p>• <strong>Required columns:</strong> Store_ID, Brand, Category</p>
            <p>• <strong>Date columns:</strong> Format as DD-MM-YYYY (e.g., 01-01-2024)</p>
            <p>• <strong>Metrics:</strong> Device Sales, Plan Sales, Attach %, Revenue</p>
            <p>• <strong>Header structure:</strong> Two-row headers with dates and metrics</p>
            <p>• <strong>Data rows:</strong> Start from row 3 onwards</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthwiseExcelImport;