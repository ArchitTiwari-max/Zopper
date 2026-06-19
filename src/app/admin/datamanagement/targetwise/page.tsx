"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  FileText,
  Terminal,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
// biome-ignore lint/correctness/noUnusedImports: React is needed for compiler JSX global scope
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import "./targetwise-import.css";

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

interface Brand {
  id: string;
  brandName: string;
}

const TargetwiseExcelImport = () => {
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

  // Custom template filters
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Set default month/year filter values
  useEffect(() => {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const currentYear = String(now.getFullYear());
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);

    // Fetch brands
    const fetchBrands = async () => {
      try {
        const res = await fetch("/api/admin/brands");
        const json = await res.json();
        if (json.success && json.data) {
          setBrands(json.data);
        }
      } catch (err) {
        console.error("Failed to load brands:", err);
      }
    };
    fetchBrands();
  }, []);

  // Auto-scroll console
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll should trigger on consoleLogs changes
  useEffect(() => {
    if (consoleEndRef.current && showConsole) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, showConsole]);

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
      console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
    },
    [],
  );

  const clearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  // Helper to skip verbose logs
  const isInternalMessage = (message: string): boolean => {
    const internalKeywords = [
      "Initializing target reference cache",
      "Target reference cache initialized",
      "Structure check",
      "Initiating row validations",
      "Finished validations. Ready to commit",
      "Writing",
      "records to the database",
    ];
    return internalKeywords.some((keyword) => message.includes(keyword));
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        addConsoleLog(
          "info",
          `📁 File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        );

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
            "❌ Invalid file format. Please upload an Excel sheet (.xlsx or .xls)",
          );
          setImportStatus({
            isImporting: false,
            result: null,
            error: "Please upload a valid Excel file (.xlsx or .xls)",
          });
          return;
        }

        addConsoleLog("success", "✅ File validation passed successfully");
        setUploadedFile(file);
        setImportStatus({
          isImporting: false,
          result: null,
          error: null,
        });
      }
    },
    [addConsoleLog],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleImport = async () => {
    if (!uploadedFile) {
      addConsoleLog("error", "❌ No file selected for import");
      return;
    }

    setShowConsole(true);
    addConsoleLog("info", "🚀 Starting Target Import process...");
    addConsoleLog("info", `📁 Reading target file: ${uploadedFile.name}`);

    setImportStatus({
      isImporting: true,
      result: null,
      error: null,
    });

    try {
      addConsoleLog("info", "📤 Uploading targets Excel file to server...");

      const formData = new FormData();
      formData.append("file", uploadedFile);

      const response = await fetch("/api/admin/excel-import/targetimport", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to initiate SSE import stream");
      }

      addConsoleLog(
        "info",
        "📨 Connecting to Server-Sent Events streaming parser...",
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            addConsoleLog("info", "🏁 Stream processing completed");
            setImportStatus((prev) => ({ ...prev, isImporting: false }));
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
                  if (data.message && !isInternalMessage(data.message)) {
                    addConsoleLog("info", data.message);
                  }

                  if (data.rowData) {
                    const { StoreBrand_ID, Category, status, message } =
                      data.rowData;
                    const icon = status === "success" ? "✅" : "❌";
                    const logType = status === "success" ? "success" : "error";

                    addConsoleLog(
                      logType,
                      `${icon} Row ${data.currentRow}/${data.totalRows}: StoreBrand_ID: ${StoreBrand_ID} | Category: ${Category}`,
                    );
                    if (message && !message.includes("queued")) {
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
                  addConsoleLog(
                    "success",
                    "🎉 Targetwise import finished successfully!",
                  );
                  addConsoleLog(
                    "info",
                    `✅ ${data.summary.successful} of ${data.summary.totalRows} store targets updated in ${data.summary.processingTime || "N/A"}`,
                  );

                  if (data.summary.failed > 0) {
                    addConsoleLog(
                      "warning",
                      `⚠️ ${data.summary.failed} store targets failed validation`,
                    );
                    data.summary.errors.slice(0, 5).forEach((error: string) => {
                      addConsoleLog(
                        "error",
                        `   └─ ${error.replace(/❌ /, "")}`,
                      );
                    });
                    if (data.summary.errors.length > 5) {
                      addConsoleLog(
                        "info",
                        `   └─ ... and ${data.summary.errors.length - 5} more errors`,
                      );
                    }
                  }

                  setImportStatus({
                    isImporting: false,
                    result: data.summary,
                    error: null,
                  });
                  setUploadedFile(null);
                  setProgressData(null);
                } else if (data.type === "error") {
                  throw new Error(data.message);
                }
              } catch (parseError) {
                console.debug("SSE line parsing skipped:", parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Import failed";
      addConsoleLog("error", `❌ Import aborted: ${errorMessage}`);
      setImportStatus({
        isImporting: false,
        result: null,
        error: errorMessage,
      });
    } finally {
      setProgressData(null);
    }
  };

  const downloadTemplate = async () => {
    try {
      const monthStr = `${selectedMonth}-${selectedYear}`;
      const params = new URLSearchParams();
      params.append("month", monthStr);
      if (selectedBrand && selectedBrand !== "ALL") {
        params.append("brand", selectedBrand);
      }

      const response = await fetch(
        `/api/admin/excel-export/target-template?${params}`,
      );
      if (!response.ok) throw new Error("Template request failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `store-targets-template-${selectedBrand}-${monthStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addConsoleLog(
        "success",
        `📥 Downloaded customized template for ${selectedBrand} and ${monthStr}`,
      );
    } catch (err) {
      addConsoleLog("error", `❌ Failed to download template: ${err}`);
    }
  };

  const clearFile = () => {
    addConsoleLog("info", "🗑️ Uploaded file cleared");
    setUploadedFile(null);
    setImportStatus({
      isImporting: false,
      result: null,
      error: null,
    });
  };

  return (
    <div className="excel-dat-sale-import-container target-import-theme">
      <div className="excel-dat-sale-import-card">
        {/* Back Link */}
        <div className="excel-dat-sale-back-button-section">
          <Link
            href="/admin/datamanagement"
            className="excel-dat-sale-back-button"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Data Management
          </Link>
        </div>

        {/* Header section */}
        <div className="excel-dat-sale-import-header">
          <div className="excel-dat-sale-header-content">
            <TrendingUp className="excel-dat-sale-header-icon target-theme" />
            <div>
              <h1 className="excel-dat-sale-import-title">
                Store Target Import
              </h1>
              <p className="excel-dat-sale-import-subtitle">
                Monthly store targets management
              </p>
            </div>
          </div>
          <p className="excel-dat-sale-import-description">
            Upload Excel spreadsheets to set or update store-wise monthly
            revenue and unit targets. The import validates store mapping
            configurations and database reference codes.
          </p>
        </div>

        {/* Customized Template Generator */}
        <div className="excel-dat-sale-template-section">
          <div className="excel-dat-sale-template-header-box">
            <div className="excel-dat-sale-template-info">
              <h3>Generate Pre-Populated Targets Template</h3>
              <p>
                Select targets timeframe and brand to export existing
                store-brand relationships
              </p>
            </div>
          </div>

          <div className="excel-dat-sale-template-filters">
            <div className="excel-dat-sale-filter-group">
              <label htmlFor="target-brand-select">Filter by Brand</label>
              <select
                id="target-brand-select"
                className="excel-dat-sale-filter-select"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                <option value="ALL">All Mapped Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.brandName}
                  </option>
                ))}
              </select>
            </div>

            <div className="excel-dat-sale-filter-group">
              <label htmlFor="target-month-select">Month</label>
              <select
                id="target-month-select"
                className="excel-dat-sale-filter-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            <div className="excel-dat-sale-filter-group">
              <label htmlFor="target-year-select">Year</label>
              <select
                id="target-year-select"
                className="excel-dat-sale-filter-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
              </select>
            </div>

            <button
              type="button"
              onClick={downloadTemplate}
              className="excel-dat-sale-template-button"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </button>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div className="excel-dat-sale-upload-section">
          <div
            {...getRootProps()}
            className={`excel-dat-sale-upload-area ${
              isDragActive ? "drag-active" : ""
            } ${uploadedFile ? "file-uploaded" : ""}`}
          >
            <input {...getInputProps()} />

            {uploadedFile ? (
              <div className="excel-dat-sale-file-info">
                <FileText className="w-8 h-8 text-rose-600" />
                <div className="excel-dat-sale-file-details">
                  <p className="excel-dat-sale-file-name">
                    {uploadedFile.name}
                  </p>
                  <p className="excel-dat-sale-file-size">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="excel-dat-sale-clear-file-button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="excel-dat-sale-upload-icon" />
                {isDragActive ? (
                  <p className="excel-dat-sale-drag-active-text">
                    Drop the targets file here...
                  </p>
                ) : (
                  <div>
                    <p className="excel-dat-sale-upload-text-primary">
                      Drag & drop targets Excel sheet here
                    </p>
                    <p className="excel-dat-sale-upload-text-secondary">
                      or click to choose file
                    </p>
                    <p className="excel-dat-sale-upload-text-info">
                      Accepts .xlsx and .xls sheets up to 10MB
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Import Trigger Button */}
        {uploadedFile && (
          <div className="excel-dat-sale-import-button-section">
            <button
              type="button"
              onClick={handleImport}
              disabled={importStatus.isImporting}
              className="excel-dat-sale-import-button"
            >
              {importStatus.isImporting ? (
                <>
                  <div className="excel-dat-sale-spinner"></div>
                  Uploading & Processing Targets...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Import Targets Data
                </>
              )}
            </button>
          </div>
        )}

        {/* Error notification */}
        {importStatus.error && (
          <div className="excel-dat-sale-error-message">
            <div className="excel-dat-sale-error-content">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
              <div>
                <h3 className="excel-dat-sale-error-title">
                  Target Import Error
                </h3>
                <p className="excel-dat-sale-error-text">
                  {importStatus.error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Completed summary display */}
        {importStatus.result && (
          <div className="excel-dat-sale-success-message">
            <div className="excel-dat-sale-success-content">
              <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
              <div className="flex-1">
                <h3 className="excel-dat-sale-success-title">
                  Targets Processed Successfully
                </h3>

                <div className="excel-dat-sale-results-grid">
                  <div className="excel-dat-sale-result-card">
                    <div className="excel-dat-sale-result-number">
                      {importStatus.result.totalRows}
                    </div>
                    <div className="excel-dat-sale-result-label">
                      Total Rows
                    </div>
                  </div>
                  <div className="excel-dat-sale-result-card">
                    <div className="excel-dat-sale-result-number success">
                      {importStatus.result.successful}
                    </div>
                    <div className="excel-dat-sale-result-label">Success</div>
                  </div>
                  <div className="excel-dat-sale-result-card">
                    <div className="excel-dat-sale-result-number error">
                      {importStatus.result.failed}
                    </div>
                    <div className="excel-dat-sale-result-label">Failed</div>
                  </div>
                </div>

                {importStatus.result.errors.length > 0 && (
                  <div>
                    <h4 className="excel-dat-sale-error-title">
                      Validation Exceptions:
                    </h4>
                    <div className="excel-dat-sale-error-details">
                      {importStatus.result.errors.map((error, index) => (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: indices are stable for static errors list
                          key={`${error}-${index}`}
                          className="excel-dat-sale-error-item"
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

        {/* Console stream log panel */}
        <div className="excel-dat-sale-console-section">
          <div className="excel-dat-sale-console-header">
            <div className="excel-dat-sale-console-header-left">
              <Terminal className="w-5 h-5 mr-2" />
              <h3 className="excel-dat-sale-console-title">
                Execution Terminal
              </h3>
              <span className="excel-dat-sale-console-count">
                ({consoleLogs.length})
              </span>
            </div>
            <div className="excel-dat-sale-console-header-right">
              {consoleLogs.length > 0 && (
                <button
                  type="button"
                  onClick={clearConsole}
                  className="excel-dat-sale-console-clear-button"
                  title="Clear Console"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowConsole(!showConsole)}
                className="excel-dat-sale-console-toggle-button"
              >
                {showConsole ? "Close Panel" : "Open Panel"}
              </button>
            </div>
          </div>

          {progressData && importStatus.isImporting && (
            <div className="excel-dat-sale-console-progress">
              <div className="excel-dat-sale-progress-info">
                <span className="excel-dat-sale-progress-text">
                  Importing row {progressData.current} of {progressData.total}
                </span>
                <span className="excel-dat-sale-progress-percentage">
                  {Math.round(
                    (progressData.current / progressData.total) * 100,
                  )}
                  %
                </span>
              </div>
              <div className="excel-dat-sale-progress-bar">
                <div
                  className="excel-dat-sale-progress-fill"
                  style={{
                    width: `${(progressData.current / progressData.total) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {showConsole && (
            <div className="excel-dat-sale-console-body">
              {consoleLogs.length === 0 ? (
                <div className="excel-dat-sale-console-empty">
                  <Terminal className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="excel-dat-sale-console-empty-text">
                    Logs terminal is currently idle.
                  </p>
                </div>
              ) : (
                <div className="excel-dat-sale-console-logs">
                  {consoleLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`excel-dat-sale-console-log excel-dat-sale-console-log-${log.type}`}
                    >
                      <span className="excel-dat-sale-console-timestamp">
                        [{log.timestamp}]
                      </span>
                      <span className="excel-dat-sale-console-message">
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

        {/* Expected Format */}
        <div className="excel-dat-sale-format-info">
          <h3 className="excel-dat-sale-format-title">
            Target Import Sheets Requirements:
          </h3>
          <div className="excel-dat-sale-format-list">
            <p>
              • <strong>Required identifier columns:</strong>{" "}
              <code>StoreBrand_ID</code> (must map exactly to records in
              database) and <code>Product Category</code> (must match category name in
              database).
            </p>
            <p>
              • <strong>Required timeframe columns:</strong> <code>Month</code>{" "}
              (numbers 1-12 or month names) and <code>Year</code> (numbers, e.g.
              2026).
            </p>
            <p>
              • <strong>Values columns (at least one is required):</strong>{" "}
              <code>Target_Revenue</code> (float value targets) and/or{" "}
              <code>Target_Units</code> (integer quantity targets).
            </p>
            <p>
              • <strong>Store Mappings check:</strong> The{" "}
              <code>StoreBrand_ID</code> must correspond to a valid active
              store-brand relationship mapped in the database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetwiseExcelImport;
