"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  Share2,
  Terminal,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
// biome-ignore lint/correctness/noUnusedImports: React needed for JSX
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import "./xiaomi-import.css";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────
interface ConsoleLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
}

interface ImportResult {
  totalRows: number;
  successful: number;
  failed: number;
  notFound: number;
  errors: string[];
  month: number;
  year: number;
  targetHeader: string;
  hasAchievement: boolean;
}

interface ImportStatus {
  isImporting: boolean;
  result: ImportResult | null;
  error: string | null;
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────
const XiaomiImportPage = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    isImporting: false,
    result: null,
    error: null,
  });
  const [progressData, setProgressData] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Month/year for template download & export
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(now.getMonth() + 1).padStart(2, "0")
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(now.getFullYear())
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on log change
  useEffect(() => {
    if (consoleEndRef.current && showConsole) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, showConsole]);

  const addLog = useCallback(
    (type: ConsoleLog["type"], message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setConsoleLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp,
          type,
          message,
        },
      ]);
    },
    []
  );

  // ─── Dropzone ──────────────────────────────────────────────
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const validTypes = [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (
        !validTypes.includes(file.type) &&
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls")
      ) {
        addLog("error", "❌ Invalid format. Please upload an Excel file (.xlsx or .xls)");
        return;
      }

      addLog("info", `📁 File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      setUploadedFile(file);
      setImportStatus({ isImporting: false, result: null, error: null });
    },
    [addLog]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024,
  });

  const clearFile = () => {
    setUploadedFile(null);
    setImportStatus({ isImporting: false, result: null, error: null });
    setProgressData(null);
    addLog("info", "🗑️ File cleared");
  };

  // ─── Import Handler ────────────────────────────────────────
  const handleImport = async () => {
    if (!uploadedFile) {
      addLog("error", "❌ No file selected");
      return;
    }

    setShowConsole(true);
    setImportStatus({ isImporting: true, result: null, error: null });
    addLog("info", "🚀 Starting Xiaomi Target/Achievement import...");
    addLog("info", `📁 Processing: ${uploadedFile.name}`);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const response = await fetch("/api/admin/excel-import/xiaomi-import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to connect to import stream");

      addLog("info", "📨 Connected to streaming server...");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            addLog("info", "🏁 Stream completed");
            setImportStatus((prev) => ({ ...prev, isImporting: false }));
            setProgressData(null);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.substring(6));

              if (data.type === "progress") {
                if (data.message) {
                  const logType =
                    data.phase === "batch_complete" ? "success" :
                    data.phase === "error" ? "error" : "info";
                  addLog(logType, data.message);
                }

                if (data.rowData) {
                  const { RetailerName, State, status, message } = data.rowData;
                  const icon = status === "success" ? "✅" : status === "not_found" ? "⚠️" : "❌";
                  const logType = status === "success" ? "success" : status === "not_found" ? "warning" : "error";
                  addLog(logType, `${icon} ${RetailerName} (${State || "—"}): ${message}`);
                }

                if (data.currentRow && data.totalRows) {
                  setProgressData({ current: data.currentRow, total: data.totalRows });
                }
              } else if (data.type === "complete") {
                const s = data.summary as ImportResult;
                addLog("success", `🎉 Import complete! ${s.successful} records saved to database.`);
                if (s.notFound > 0) {
                  addLog("warning", `⚠️ ${s.notFound} stores not found in DB — please check store names`);
                }
                if (s.failed > 0) {
                  addLog("error", `❌ ${s.failed} records failed to write`);
                }
                setImportStatus({ isImporting: false, result: s, error: null });
                setUploadedFile(null);
                setProgressData(null);
              } else if (data.type === "error") {
                throw new Error(data.message);
              }
            } catch (parseErr) {
              console.debug("SSE parse skip:", parseErr);
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      addLog("error", `❌ ${msg}`);
      setImportStatus({ isImporting: false, result: null, error: msg });
      setProgressData(null);
    }
  };

  // ─── Download Template / Export ────────────────────────────
  const triggerDownload = async (mode: "template" | "export") => {
    const setter = mode === "template" ? setIsDownloading : setIsExporting;
    setter(true);
    try {
      const params = new URLSearchParams({
        month: String(parseInt(selectedMonth, 10)),
        year: selectedYear,
        mode,
      });
      const res = await fetch(`/api/admin/excel-export/xiaomi-template?${params}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const monthShort = new Date(
        parseInt(selectedYear), parseInt(selectedMonth) - 1
      ).toLocaleString("en-US", { month: "short" });
      const label = mode === "template" ? "xiaomi-template" : "xiaomi-export";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label}-${monthShort}-${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setter(false);
    }
  };

  const pct = progressData
    ? Math.round((progressData.current / progressData.total) * 100)
    : 0;

  const result = importStatus.result;
  const isPartial = result && (result.failed > 0 || result.notFound > 0);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="xiaomi-import-container">
      <div className="xiaomi-import-card">

        {/* Back */}
        <Link href="/admin/datamanagement" className="xiaomi-back-btn">
          <ArrowLeft size={16} />
          Back to Data Management
        </Link>

        {/* Header */}
        <div className="xiaomi-header">
          <div className="xiaomi-header-icon">
            <Zap size={28} color="#fff" />
          </div>
          <div>
            <h1 className="xiaomi-header-title">
              Xiaomi Target & Achievement Import
              <span className="xiaomi-header-badge">Xiaomi</span>
            </h1>
            <p className="xiaomi-header-subtitle">
              Upload targets for a new month, or update achievements for an existing month
            </p>
          </div>
        </div>

        {/* Format Guide */}
        <div className="xiaomi-format-box">
          <p className="xiaomi-format-title">
            <FileSpreadsheet size={14} />
            Expected Excel Format
          </p>
          <table className="xiaomi-format-table">
            <thead>
              <tr>
                <th><span className="col-tag required">State</span></th>
                <th><span className="col-tag required">RetailerName</span></th>
                <th style={{ background: "rgba(255,100,0,0.2)" }}>
                  <span className="col-tag required">Jul-26 (Target)</span>
                  <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", display: "block", marginTop: "2px" }}>Auto-detected from header</span>
                </th>
                <th style={{ background: "rgba(34,197,94,0.15)" }}>
                  <span className="col-tag optional" style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", borderColor: "rgba(34,197,94,0.4)" }}>Achievement</span>
                  <span style={{ fontSize: "0.65rem", color: "#4ade80", display: "block", marginTop: "2px" }}>Optional column</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>UP</td>
                <td>ABC Mobile Store</td>
                <td style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>50000 (locked)</td>
                <td style={{ color: "#4ade80", fontWeight: 600 }}>32000</td>
              </tr>
              <tr>
                <td>MH</td>
                <td>XYZ Electronics</td>
                <td style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>75000 (locked)</td>
                <td style={{ color: "rgba(255,255,255,0.3)" }}>(empty — fill in)</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: "0.6rem", marginBottom: 0 }}>
            💡 You can upload the raw Xiaomi Excel file to set <strong style={{ color: "#fb923c" }}>Targets</strong> for a new month. 
            Later, download a template below to fill in <strong style={{ color: "#4ade80" }}>Achievements</strong> and re-upload. Both will update based on what is provided.
          </p>
        </div>

        {/* Template Download & Export Section */}
        <div className="xiaomi-template-section">
          <div className="xiaomi-template-header">
            <FileSpreadsheet size={15} style={{ color: "#fb923c" }} />
            <span className="xiaomi-template-label">Download / Export</span>
          </div>

          <div className="xiaomi-template-controls">
            {/* Month selector */}
            <div className="xiaomi-select-group">
              <label htmlFor="xiaomi-month-sel" className="xiaomi-select-label">Month</label>
              <select
                id="xiaomi-month-sel"
                className="xiaomi-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {MONTH_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Year selector */}
            <div className="xiaomi-select-group">
              <label htmlFor="xiaomi-year-sel" className="xiaomi-select-label">Year</label>
              <select
                id="xiaomi-year-sel"
                className="xiaomi-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            <div className="xiaomi-template-btns">
              {/* Download Template — blank target & achievement cols pre-filled from DB */}
              <button
                type="button"
                id="xiaomi-download-template-btn"
                className="xiaomi-tpl-btn download"
                onClick={() => triggerDownload("template")}
                disabled={isDownloading || isExporting}
                title="Download pre-filled template with all Xiaomi stores and existing DB values"
              >
                {isDownloading ? (
                  <Loader2 size={15} className="xiaomi-spinner" />
                ) : (
                  <Download size={15} />
                )}
                Download Template
              </button>

              {/* Export — same as template but labelled as export */}
              <button
                type="button"
                id="xiaomi-export-btn"
                className="xiaomi-tpl-btn export"
                onClick={() => triggerDownload("export")}
                disabled={isDownloading || isExporting}
                title="Export current DB data — shows what targets & achievements are already set"
              >
                {isExporting ? (
                  <Loader2 size={15} className="xiaomi-spinner" />
                ) : (
                  <Share2 size={15} />
                )}
                Export DB Data
              </button>
            </div>
          </div>

          <p className="xiaomi-template-hint">
            💡 Template is pre-filled with existing DB values — orange column = Target, green column = Achievement
          </p>
        </div>

        {/* Dropzone or File Selected */}
        {!uploadedFile ? (
          <div
            {...getRootProps()}
            className={`xiaomi-dropzone ${isDragActive ? "drag-active" : ""}`}
          >
            <input {...getInputProps()} id="xiaomi-file-input" />
            <Upload size={48} className="xiaomi-dropzone-icon" />
            <p className="xiaomi-dropzone-title">
              {isDragActive ? "Drop your Excel file here" : "Drag & drop Xiaomi Excel file"}
            </p>
            <p className="xiaomi-dropzone-sub">
              or <span>click to browse</span> &nbsp;·&nbsp; .xlsx / .xls &nbsp;·&nbsp; max 10 MB
            </p>
          </div>
        ) : (
          <div className="xiaomi-file-selected">
            <FileSpreadsheet size={28} className="xiaomi-file-icon" />
            <div className="xiaomi-file-info">
              <div className="xiaomi-file-name">{uploadedFile.name}</div>
              <div className="xiaomi-file-size">
                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to import
              </div>
            </div>
            <button
              type="button"
              className="xiaomi-file-remove"
              onClick={clearFile}
              disabled={importStatus.isImporting}
            >
              <X size={12} /> Remove
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="xiaomi-actions">
          <button
            type="button"
            className="xiaomi-btn-import"
            onClick={handleImport}
            disabled={!uploadedFile || importStatus.isImporting}
            id="xiaomi-start-import-btn"
          >
            {importStatus.isImporting ? (
              <>
                <Loader2 size={18} className="xiaomi-spinner" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={18} />
                Start Import
              </>
            )}
          </button>

          {consoleLogs.length > 0 && (
            <button
              type="button"
              className="xiaomi-btn-clear"
              onClick={() => setConsoleLogs([])}
              disabled={importStatus.isImporting}
            >
              <Trash2 size={14} />
              Clear Log
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {importStatus.isImporting && progressData && (
          <div className="xiaomi-progress-bar-wrap">
            <div
              className="xiaomi-progress-bar-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Console */}
        {consoleLogs.length > 0 && (
          <>
            <div
              className="xiaomi-console-toggle"
              onClick={() => setShowConsole((v) => !v)}
              role="button"
              aria-expanded={showConsole}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setShowConsole((v) => !v)}
            >
              <span className="xiaomi-console-label">
                {importStatus.isImporting && <span className="xiaomi-console-dot" />}
                <Terminal size={13} />
                Import Log &nbsp;
                <span style={{ opacity: 0.4, fontWeight: 400 }}>
                  ({consoleLogs.length} lines)
                </span>
              </span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" }}>
                {showConsole ? "▲ collapse" : "▼ expand"}
              </span>
            </div>

            {showConsole && (
              <div className="xiaomi-console-body">
                {consoleLogs.map((log) => (
                  <div key={log.id} className={`log-line log-${log.type}`}>
                    <span className="log-time">{log.timestamp}</span>
                    <span className="log-msg">{log.message}</span>
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            )}
          </>
        )}

        {/* Error Banner */}
        {importStatus.error && !importStatus.isImporting && (
          <div style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            color: "#f87171",
            fontSize: "0.875rem",
            marginTop: "0.5rem",
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            {importStatus.error}
          </div>
        )}

        {/* Result Summary */}
        {result && (
          <div className={`xiaomi-result-box ${isPartial ? "partial" : "success"}`}>
            <p className="xiaomi-result-title">
              {isPartial ? (
                <><AlertCircle size={18} /> Import Completed with Warnings</>
              ) : (
                <><CheckCircle size={18} /> Import Successful</>
              )}
            </p>

            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", marginBottom: "1rem" }}>
              Period: <strong style={{ color: "#fb923c" }}>{MONTH_NAMES[result.month]} {result.year}</strong>
              &nbsp;·&nbsp; Target column: <strong style={{ color: "#fb923c" }}>{result.targetHeader}</strong>
              {result.hasAchievement && <>&nbsp;·&nbsp; <span style={{ color: "#a5b4fc" }}>Achievement data included ✓</span></>}
            </p>

            <div className="xiaomi-result-stats">
              <div className="xiaomi-stat total-stat">
                <div className="xiaomi-stat-number">{result.totalRows}</div>
                <div className="xiaomi-stat-label">Total Rows</div>
              </div>
              <div className="xiaomi-stat success-stat">
                <div className="xiaomi-stat-number">{result.successful}</div>
                <div className="xiaomi-stat-label">Updated</div>
              </div>
              <div className="xiaomi-stat notfound-stat">
                <div className="xiaomi-stat-number">{result.notFound}</div>
                <div className="xiaomi-stat-label">Not Found</div>
              </div>
              <div className="xiaomi-stat failed-stat">
                <div className="xiaomi-stat-number">{result.failed}</div>
                <div className="xiaomi-stat-label">Failed</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="xiaomi-errors-list">
                <p className="xiaomi-errors-title">⚠ Skipped / Failed rows</p>
                <ul>
                  {result.errors.slice(0, 20).map((e, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    <li key={i}>{e}</li>
                  ))}
                  {result.errors.length > 20 && (
                    <li style={{ color: "rgba(255,255,255,0.3)" }}>
                      ... and {result.errors.length - 20} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default XiaomiImportPage;
