"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  FileText,
  Terminal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import "./godrejsfdc-import.css";

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
  type: "info" | "success" | "error" | "warning";
  message: string;
}

const GodrejSfdcImport = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    result: null,
    error: null,
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [progressData, setProgressData] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (consoleEndRef.current && showConsole) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, showConsole]);

  // Helper function to add console logs
  const addConsoleLog = useCallback(
    (type: ConsoleLog["type"], message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      const newLog: ConsoleLog = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        type,
        message,
      };
      setConsoleLogs((prev) => [...prev, newLog]);

      // Also log to browser console for debugging
      console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
    },
    [],
  );

  const fetchRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      const response = await fetch("/api/executive/godrej-sfdc");
      if (response.ok) {
        const data = await response.json();
        setRecords(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch records:", error);
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Clear console logs
  const clearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  // Helper function to filter out internal/technical messages
  const isInternalMessage = useCallback((message: string): boolean => {
    const internalKeywords = [
      "Initializing performance cache",
      "Cache initialized - 10x performance boost",
      "Parsing Excel file",
      "File structure:",
      "Starting row-by-row processing",
      "Writing",
      "validated records to database",
      "Starting batch processing",
      "Batch processing complete:",
      "Processing completed in",
    ];

    return internalKeywords.some((keyword) => message.includes(keyword));
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      addConsoleLog(
        "info",
        `📁 File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      );

      // Validate file type
      const validTypes = [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      if (
        !validTypes.includes(file.type) &&
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls")
      ) {
        addConsoleLog(
          "error",
          "❌ Invalid file type. Please upload a valid Excel file (.xlsx or .xls)",
        );
        setImportStatus({
          isImporting: false,
          result: null,
          error: "Please upload a valid Excel file (.xlsx or .xls)",
        });
        return;
      }

      addConsoleLog("success", "✅ File validation passed");
      setUploadedFile(file);
      setImportStatus({
        isImporting: false,
        result: null,
        error: null,
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB max
  });

  const handleImport = async () => {
    if (!uploadedFile) {
      addConsoleLog("error", "❌ No file selected for import");
      return;
    }

    // Show console automatically when import starts
    setShowConsole(true);
    addConsoleLog("info", "🚀 Starting import process...");
    addConsoleLog("info", `📊 Processing file: ${uploadedFile.name}`);

    setImportStatus({
      isImporting: true,
      result: null,
      error: null,
    });
    
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      addConsoleLog("info", "📤 Uploading file to server...");

      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("type", "godrejsfdc");

      // Set a dynamic timeout based on file size (larger files need more time)
      const fileSize = uploadedFile.size / (1024 * 1024); // Size in MB
      const timeoutDuration = Math.max(30000, fileSize * 5000); // At least 30s, +5s per MB

      timeoutId = setTimeout(() => {
        addConsoleLog(
          "info",
          `🔄 Processing file (${fileSize.toFixed(1)} MB)...`,
        );
      }, timeoutDuration);

      const response = await fetch("/api/admin/godrej-sfdc/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to start import stream");
      }

      addConsoleLog("info", "📨 Connected to streaming import");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            addConsoleLog("info", "🏁 Stream completed");
            // Ensure loading state is cleared when stream ends
            setImportStatus((prev) => ({
              ...prev,
              isImporting: false,
            }));
            setProgressData(null);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.type === "progress") {
                  // Only show user-relevant messages, filter out technical details
                  if (data.message && !isInternalMessage(data.message)) {
                    addConsoleLog("info", data.message);
                  }

                  if (data.rowData) {
                    const {
                      planId,
                      phone,
                      contractBookingId,
                      status,
                      message,
                    } = data.rowData;
                    const icon = status === "success" ? "✅" : "❌";
                    const logType = status === "success" ? "success" : "error";

                    addConsoleLog(
                      logType,
                      `${icon} Row ${data.currentRow}/${data.totalRows}: ${planId} | ${phone} | ${contractBookingId}`,
                    );
                    if (message && message !== "Records processed:") {
                      addConsoleLog(
                        logType === "success" ? "info" : "error",
                        `   └─ ${message}`,
                      );
                    }
                  }

                  if (data.currentRow && data.totalRows) {
                    setProgressData({
                      current: data.currentRow,
                      total: data.totalRows,
                    });
                  }
                } else if (data.type === "complete") {
                  addConsoleLog("success", "🎉 Import completed successfully!");

                  // Show user-friendly summary
                  const processingTime = data.summary.processingTime || "N/A";
                  addConsoleLog(
                    "info",
                    `✅ ${data.summary.successful} of ${data.summary.totalRows} records imported successfully in ${processingTime}`,
                  );

                  if (data.summary.failed > 0) {
                    addConsoleLog(
                      "warning",
                      `⚠️ ${data.summary.failed} records failed to import`,
                    );

                    // Show first few errors
                    data.summary.errors.slice(0, 3).forEach((error: string) => {
                      addConsoleLog(
                        "error",
                        `   └─ ${error.replace(/❌ /g, "")}`,
                      );
                    });

                    if (data.summary.errors.length > 3) {
                      addConsoleLog(
                        "info",
                        `   └─ ... and ${data.summary.errors.length - 3} more errors`,
                      );
                    }
                  }

                  setImportStatus({
                    isImporting: false,
                    result: data.summary,
                    error: null,
                  });

                  setUploadedFile(null);
                  addConsoleLog("info", "🧹 Cleared uploaded file");
                  setProgressData(null);
                  fetchRecords(); // Refresh table
                } else if (data.type === "error") {
                  throw new Error(data.message);
                }
              } catch (parseError) {
                // Silently ignore minor SSE parsing errors that don't affect functionality
                console.debug("Minor SSE parsing error (ignored):", parseError);
              }
            }
          }
        }

        // Clear the timeout when processing completes normally
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Clear the timeout on error
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      const errorMessage =
        error instanceof Error ? error.message : "Import failed";
      addConsoleLog("error", `❌ Import failed: ${errorMessage}`);

      setImportStatus({
        isImporting: false,
        result: null,
        error: errorMessage,
      });
    } finally {
      // Ensure loading state is always cleared
      setImportStatus((prev) => ({
        ...prev,
        isImporting: false,
      }));
      setProgressData(null);
    }
  };

  const downloadTemplate = () => {
    // Create a link to download the template
    const link = document.createElement("a");
    link.href = "/templates/godrej-sfdc-template.xlsx";
    link.download = "godrej-sfdc-template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFile = () => {
    addConsoleLog("info", "🗑️ File cleared by user");
    setUploadedFile(null);
    setImportStatus({
      isImporting: false,
      result: null,
      error: null,
    });
  };

  return (
    <div className="excel-godrej-sfdc-import-container">
      <div className="excel-godrej-sfdc-import-card">
        {/* Template Download */}
        <div className="excel-godrej-sfdc-template-section">
          <div className="excel-godrej-sfdc-template-content">
            <div className="excel-godrej-sfdc-template-info">
              <h3>Need a template?</h3>
              <p>Download the Excel template to see the expected format</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="excel-godrej-sfdc-template-button"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="excel-godrej-sfdc-upload-section">
          <div
            {...getRootProps()}
            className={`excel-godrej-sfdc-upload-area ${
              isDragActive ? "drag-active" : ""
            } ${uploadedFile ? "file-uploaded" : ""}`}
          >
            <input {...getInputProps()} />

            {uploadedFile ? (
              <div className="excel-godrej-sfdc-file-info">
                <FileText className="w-8 h-8 text-green-600" />
                <div className="excel-godrej-sfdc-file-details">
                  <p className="excel-godrej-sfdc-file-name">
                    {uploadedFile.name}
                  </p>
                  <p className="excel-godrej-sfdc-file-size">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="excel-godrej-sfdc-clear-file-button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="excel-godrej-sfdc-upload-icon" />
                {isDragActive ? (
                  <p className="excel-godrej-sfdc-upload-text-primary">
                    Drop the Excel file here...
                  </p>
                ) : (
                  <div>
                    <p className="excel-godrej-sfdc-upload-text-primary">
                      Drag and drop your Excel file here
                    </p>
                    <p className="excel-godrej-sfdc-upload-text-secondary">
                      or click to browse
                    </p>
                    <p className="excel-godrej-sfdc-upload-text-info">
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
          <div className="excel-godrej-sfdc-import-button-section">
            <button
              onClick={handleImport}
              disabled={importStatus.isImporting}
              className="excel-godrej-sfdc-import-button"
            >
              {importStatus.isImporting ? (
                <>
                  <div className="excel-godrej-sfdc-spinner"></div>
                  Processing Import...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Import Godrej SFDC Data
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Display */}
        {importStatus.error && (
          <div className="excel-godrej-sfdc-error-message">
            <div className="excel-godrej-sfdc-error-content">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
              <div>
                <h3 className="excel-godrej-sfdc-error-title">Import Failed</h3>
                <p className="excel-godrej-sfdc-error-text">
                  {importStatus.error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success/Results Display */}
        {importStatus.result && (
          <div className="excel-godrej-sfdc-success-message">
            <div className="excel-godrej-sfdc-success-content">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
              <div className="flex-1">
                <h3 className="excel-godrej-sfdc-success-title">
                  Import Completed
                </h3>

                <div className="excel-godrej-sfdc-results-grid">
                  <div className="excel-godrej-sfdc-result-card">
                    <div className="excel-godrej-sfdc-result-number">
                      {importStatus.result.totalRows}
                    </div>
                    <div className="excel-godrej-sfdc-result-label">
                      Total Rows
                    </div>
                  </div>
                  <div className="excel-godrej-sfdc-result-card">
                    <div className="excel-godrej-sfdc-result-number success">
                      {importStatus.result.successful}
                    </div>
                    <div className="excel-godrej-sfdc-result-label">
                      Successful
                    </div>
                  </div>
                  <div className="excel-godrej-sfdc-result-card">
                    <div className="excel-godrej-sfdc-result-number error">
                      {importStatus.result.failed}
                    </div>
                    <div className="excel-godrej-sfdc-result-label">Failed</div>
                  </div>
                </div>

                {importStatus.result.errors.length > 0 && (
                  <div>
                    <h4 className="excel-godrej-sfdc-error-title">
                      Error Details:
                    </h4>
                    <div className="excel-godrej-sfdc-error-details">
                      {importStatus.result.errors.map((error, index) => (
                        <div
                          key={index}
                          className="excel-godrej-sfdc-error-item"
                        >
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
        <div className="excel-godrej-sfdc-console-section">
          <div className="excel-godrej-sfdc-console-header">
            <div className="excel-godrej-sfdc-console-header-left">
              <Terminal className="w-5 h-5 mr-2" />
              <h3 className="excel-godrej-sfdc-console-title">Activity Log</h3>
              <span className="excel-godrej-sfdc-console-count">
                ({consoleLogs.length})
              </span>
            </div>
            <div className="excel-godrej-sfdc-console-header-right">
              {consoleLogs.length > 0 && (
                <button
                  onClick={clearConsole}
                  className="excel-godrej-sfdc-console-clear-button"
                  title="Clear logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowConsole(!showConsole)}
                className="excel-godrej-sfdc-console-toggle-button"
              >
                {showConsole ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {progressData && importStatus.isImporting && (
            <div className="excel-godrej-sfdc-console-progress">
              <div className="excel-godrej-sfdc-progress-info">
                <span className="excel-godrej-sfdc-progress-text">
                  Processing row {progressData.current} of {progressData.total}
                </span>
                <span className="excel-godrej-sfdc-progress-percentage">
                  {Math.round(
                    (progressData.current / progressData.total) * 100,
                  )}
                  %
                </span>
              </div>
              <div className="excel-godrej-sfdc-progress-bar">
                <div
                  className="excel-godrej-sfdc-progress-fill"
                  style={{
                    width: `${(progressData.current / progressData.total) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {showConsole && (
            <div className="excel-godrej-sfdc-console-body">
              {consoleLogs.length === 0 ? (
                <div className="excel-godrej-sfdc-console-empty">
                  <Terminal className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="excel-godrej-sfdc-console-empty-text">
                    No activity yet. Upload and import a file to see logs.
                  </p>
                </div>
              ) : (
                <div className="excel-godrej-sfdc-console-logs">
                  {consoleLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`excel-godrej-sfdc-console-log excel-godrej-sfdc-console-log-${log.type}`}
                    >
                      <span className="excel-godrej-sfdc-console-timestamp">
                        [{log.timestamp}]
                      </span>
                      <span className="excel-godrej-sfdc-console-message">
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Format Information */}
        <div className="excel-godrej-sfdc-format-info">
          <h3 className="excel-godrej-sfdc-format-title">
            Expected Excel Format:
          </h3>
          <div className="excel-godrej-sfdc-format-list">
            <p>
              • <strong>Required columns:</strong> Plan Id, Phone, ContractBookingID
            </p>
            <p>
              • <strong>Data format:</strong> Plain values (no special
              formatting needed)
            </p>
            <p>
              • <strong>Header row:</strong> Content should start from row 2 (row 1 is ignored if headers are complex)
            </p>
          </div>
        </div>

        {/* Records Table */}
        <div className="excel-godrej-sfdc-records-table-section">
          <h3 className="excel-godrej-sfdc-table-title">Imported Records</h3>
          {isLoadingRecords ? (
            <div className="excel-godrej-sfdc-table-loading">Loading records...</div>
          ) : records.length === 0 ? (
            <div className="excel-godrej-sfdc-table-empty">No records imported yet.</div>
          ) : (
            <div className="excel-godrej-sfdc-table-wrapper">
              <table className="excel-godrej-sfdc-table">
                <thead>
                  <tr>
                    <th>Plan Id</th>
                    <th>Phone</th>
                    <th>ContractBookingID</th>
                    <th>Uploaded At</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.planId}</td>
                      <td>{record.phone}</td>
                      <td>{record.contractBookingId}</td>
                      <td>{new Date(record.uploadedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GodrejSfdcImport;
