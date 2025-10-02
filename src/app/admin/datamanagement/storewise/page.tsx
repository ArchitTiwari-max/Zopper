'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, X, Download, Terminal, Trash2, ArrowLeft, Store, UserPlus, UserMinus } from 'lucide-react';
import Link from 'next/link';
import './storewise-import.css';

interface ImportResult {
  totalRows: number;
  successful: number;
  failed: number;
  errors: string[];
  totalExecutivesAdded: number;
  totalExecutivesRemoved: number;
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

const StorewiseExcelImport = () => {
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
      'Initializing store import cache',
      'Cache initialized - 10x performance boost',
      'Parsing store Excel file',
      'Store file structure:',
      'Starting row-by-row validation',
      'Writing', 'validated stores to database',
      'Starting batch processing',
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
    addConsoleLog('info', '🚀 Starting store import process...');
    addConsoleLog('info', `🏪 Processing store file: ${uploadedFile.name}`);

    setImportStatus({
      isImporting: true,
      result: null,
      error: null
    });

    try {
      addConsoleLog('info', '📤 Uploading file to server...');
      
      // Set a dynamic timeout based on file size (larger files need more time)
      const fileSize = uploadedFile.size / (1024 * 1024); // Size in MB
      const timeoutDuration = Math.max(60000, fileSize * 10000); // At least 60s, +10s per MB
      
      const timeoutId = setTimeout(() => {
        addConsoleLog('info', `🔄 Processing large file (${fileSize.toFixed(1)} MB) - this may take a few minutes...`);
      }, timeoutDuration);
      
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/admin/excel-import/storeimport', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start store import stream');
      }

      addConsoleLog('info', '📨 Connected to streaming store import');
      
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
          const lines = buffer.split('\\n\\n');
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
                    const { Store_ID, Store_Name, City, status, message, executivesAdded, executivesRemoved } = data.rowData;
                    const icon = status === 'success' ? '✅' : '❌';
                    const logType = status === 'success' ? 'success' : 'error';
                    
                    addConsoleLog(logType, `${icon} Row ${data.currentRow}/${data.totalRows}: ${Store_ID} | ${Store_Name} | ${City}`);
                    
                    // Show executive changes
                    if (status === 'success' && (executivesAdded > 0 || executivesRemoved > 0)) {
                      const changes = [];
                      if (executivesAdded > 0) changes.push(`+${executivesAdded} executives`);
                      if (executivesRemoved > 0) changes.push(`-${executivesRemoved} executives`);
                      addConsoleLog('info', `   └─ Executive changes: ${changes.join(', ')}`);
                    }
                    
                    if (message && status === 'error') {
                      addConsoleLog('error', `   └─ ${message}`);
                    }
                  }
                  
                  if (data.currentRow && data.totalRows) {
                    setProgressData({
                      current: data.currentRow,
                      total: data.totalRows
                    });
                  }
                } else if (data.type === 'complete') {
                  addConsoleLog('success', '🎉 Store import completed successfully!');
                  
                  // Show user-friendly summary
                  const processingTime = data.summary.processingTime || 'N/A';
                  addConsoleLog('info', `✅ ${data.summary.successful} of ${data.summary.totalRows} stores processed successfully in ${processingTime}`);
                  
                  // Show executive changes summary
                  if (data.summary.totalExecutivesAdded > 0 || data.summary.totalExecutivesRemoved > 0) {
                    addConsoleLog('info', `👥 Executive assignments updated: +${data.summary.totalExecutivesAdded} added, -${data.summary.totalExecutivesRemoved} removed`);
                  }
                  
                  if (data.summary.failed > 0) {
                    addConsoleLog('warning', `⚠️ ${data.summary.failed} stores failed to process`);
                    
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

      clearTimeout(timeoutId);

    } catch (error) {
      console.error('Store import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process store Excel file';
      
      addConsoleLog('error', `❌ Import failed: ${errorMessage}`);
      setImportStatus({
        isImporting: false,
        result: null,
        error: errorMessage
      });
      setProgressData(null);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setImportStatus({
      isImporting: false,
      result: null,
      error: null
    });
    addConsoleLog('info', '🗑️ File cleared');
  };

  const downloadTemplate = () => {
    // Create a link to download the Excel template
    const link = document.createElement('a');
    link.href = '/templates/store-import-template.xlsx';
    link.download = 'store-import-template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addConsoleLog('info', '📅 Excel template downloaded successfully');
  };

  return (
    <div className="excel-stor-sale-import-container">
      <div className="excel-stor-sale-import-card">
        {/* Back Button */}
        <div className="excel-stor-sale-back-button-section">
          <Link href="/admin/datamanagement" className="excel-stor-sale-back-button">
            <ArrowLeft size={16} />
            <span style={{ marginLeft: '0.5rem' }}>Back to Data Management</span>
          </Link>
        </div>

        {/* Header */}
        <div className="excel-stor-sale-import-header">
          <h1 className="excel-stor-sale-import-title">
            <Store className="inline mr-2" size={24} />
            Stores Import
          </h1>
          <p className="excel-stor-sale-import-description">
            Upload Excel files to import store information and manage executive assignments. 
            You can add or remove executives from stores using this import.
          </p>
        </div>

        {/* Template Download */}
        <div className="excel-stor-sale-template-section">
          <div className="excel-stor-sale-template-content">
            <div className="excel-stor-sale-template-info">
              <h3>Need a template?</h3>
              <p>Download the Excel template with the correct format for store imports</p>
            </div>
            <button onClick={downloadTemplate} className="excel-stor-sale-template-button">
              <Download size={16} />
              <span style={{ marginLeft: '0.5rem' }}>Download Template</span>
            </button>
          </div>
        </div>

        {/* File Upload */}
        <div className="excel-stor-sale-upload-section">
          <div 
            {...getRootProps()} 
            className={`excel-stor-sale-upload-area ${isDragActive ? 'drag-active' : ''} ${uploadedFile ? 'file-uploaded' : ''}`}
          >
            <input {...getInputProps()} />
            
            {uploadedFile ? (
              <div className="excel-stor-sale-file-info">
                <FileText size={32} color="#16a34a" />
                <div className="excel-stor-sale-file-details">
                  <div className="excel-stor-sale-file-name">{uploadedFile.name}</div>
                  <div className="excel-stor-sale-file-size">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="excel-stor-sale-clear-file-button"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <>
                <Upload className="excel-stor-sale-upload-icon"/>
                <div className="excel-stor-sale-upload-text-primary">
                  {isDragActive ? 'Drop the store Excel file here' : 'Upload Store Excel File'}
                </div>
                <div className="excel-stor-sale-upload-text-secondary">
                  Drag & drop your store import file here, or click to browse
                </div>
                <div className="excel-stor-sale-upload-text-info">
                  Supports: .xlsx, .xls files up to 10MB
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {progressData && (
          <div className="excel-stor-sale-progress-section">
            <div className="excel-stor-sale-progress-bar">
              <div 
                className="excel-stor-sale-progress-fill"
                style={{ width: `${(progressData.current / progressData.total) * 100}%` }}
              />
            </div>
            <div className="excel-stor-sale-progress-text">
              Processing store {progressData.current} of {progressData.total} ({((progressData.current / progressData.total) * 100).toFixed(1)}%)
            </div>
          </div>
        )}

        {/* Import Button */}
        <div className="excel-stor-sale-import-button-section">
          <button 
            onClick={handleImport}
            disabled={!uploadedFile || importStatus.isImporting}
            className="excel-stor-sale-import-button"
          >
            {importStatus.isImporting ? (
              <>
                <div className="excel-stor-sale-loading-spinner" />
                Processing Store Import...
              </>
            ) : (
              <>
                <Store size={20} />
                Import Stores & Executives
              </>
            )}
          </button>
        </div>

        {/* Console */}
        <div className="excel-stor-sale-console-section">
          <div className="excel-stor-sale-console-header">
            <div className="excel-stor-sale-console-title">
              <Terminal size={16} />
              Activity Log
            </div>
            <div className="excel-stor-sale-console-controls">
              <button 
                onClick={() => setShowConsole(!showConsole)}
                className="excel-stor-sale-console-control-button"
              >
                {showConsole ? 'Hide' : 'Show'}
              </button>
              <button 
                onClick={clearConsole}
                className="excel-stor-sale-console-control-button"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
          </div>
          
          {showConsole && (
            <div className="excel-stor-sale-console-body">
              {consoleLogs.length === 0 ? (
                <div className="excel-stor-sale-console-empty">No activity yet. Upload a file to begin.</div>
              ) : (
                consoleLogs.map((log) => (
                  <div key={log.id} className={`excel-stor-sale-console-log ${log.type}`}>
                    <span className="excel-stor-sale-console-timestamp">[{log.timestamp}]</span>
                    {log.message}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>

        {/* Results */}
        {importStatus.result && (
          <div className="excel-stor-sale-result-section">
            <div className={importStatus.result.failed > 0 ? "excel-stor-sale-result-error" : "excel-stor-sale-result-success"}>
              <div className="excel-stor-sale-result-header">
                {importStatus.result.failed > 0 ? (
                  <>
                    <AlertCircle size={20} />
                    Import Completed with Errors
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Import Completed Successfully
                  </>
                )}
              </div>
              
              <div className="excel-stor-sale-result-stats">
                <div className="excel-stor-sale-result-stat">
                  <div className="excel-stor-sale-result-stat-label">Total Stores</div>
                  <div className="excel-stor-sale-result-stat-value">{importStatus.result.totalRows}</div>
                </div>
                <div className="excel-stor-sale-result-stat">
                  <div className="excel-stor-sale-result-stat-label">Successful</div>
                  <div className="excel-stor-sale-result-stat-value">{importStatus.result.successful}</div>
                </div>
                <div className="excel-stor-sale-result-stat">
                  <div className="excel-stor-sale-result-stat-label">Failed</div>
                  <div className="excel-stor-sale-result-stat-value">{importStatus.result.failed}</div>
                </div>
                <div className="excel-stor-sale-result-stat">
                  <div className="excel-stor-sale-result-stat-label executive-added">Executives Assigned Added</div>
                  <div className="excel-stor-sale-result-stat-value">
                    <UserPlus className="inline mr-1" size={16} />
                    {importStatus.result.totalExecutivesAdded}
                  </div>
                </div>
                <div className="excel-stor-sale-result-stat">
                  <div className="excel-stor-sale-result-stat-label executive-removed">Executives Assigned Removed</div>
                  <div className="excel-stor-sale-result-stat-value">
                    <UserMinus className="inline mr-1" size={16} />
                    {importStatus.result.totalExecutivesRemoved}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {importStatus.error && (
          <div className="excel-stor-sale-result-section">
            <div className="excel-stor-sale-result-error">
              <div className="excel-stor-sale-result-header">
                <AlertCircle size={20} />
                Import Failed
              </div>
              <p>{importStatus.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorewiseExcelImport;
