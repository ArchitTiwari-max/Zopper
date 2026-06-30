"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MapPin,
  Monitor,
  Search,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import VisitDetailsModal from "../../admin/components/VisitDetailsModal";
import "./subordinate-visits.css";
import "../../admin/visit-report/visit-report.css";

interface AssignedIssue {
  id: string;
  adminComment: string | null;
  status: string;
  createdAt: string;
  executiveName: string;
}

interface Issue {
  id: string;
  details: string;
  status: string;
  createdAt: string;
  assigned: AssignedIssue[];
}

interface SubordinateVisit {
  id: string;
  type: "Physical" | "Digital";
  storeId: string;
  storeName: string;
  city: string;
  partnerBrand: string;
  status: string;
  reviewerName?: string;
  representative: string;
  personMet: any;
  POSMchecked: boolean | null;
  remarks: string;
  imageUrls: string[];
  adminComment: string | null;
  brandVisitDetails: any;
  date: string;
  visitDate: string;
  createdAt: string;
  updatedAt: string;
  issues?: Issue[];
}

type DateRange = "today" | "last_30" | "last_90" | "last_year";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: "Today",
  last_30: "Last 30 Days",
  last_90: "Last 90 Days",
  last_year: "Last Year",
};

const PAGE_SIZE = 50;

export default function SubordinateVisitsPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<SubordinateVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination states
  const [selectedExecutive, setSelectedExecutive] = useState<string>("All");
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [visitType, setVisitType] = useState<"Physical" | "Digital">(
    "Physical",
  );
  const [dateRange, setDateRange] = useState<DateRange>("last_30");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Full subordinate list — fetched independently so all appear in dropdown
  // regardless of whether they have visits in the selected date range
  const [subordinateList, setSubordinateList] = useState<
    { id: string; name: string }[]
  >([]);

  // Modal State
  const [selectedVisit, setSelectedVisit] = useState<SubordinateVisit | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);

  const fetchSubordinateVisits = useCallback(
    async (range: DateRange, page: number) => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
          `/api/executive/subordinate-visits?range=${range}&page=${page}`,
          { cache: 'no-store' }
        );

        if (!response.ok) throw new Error("Failed to fetch subordinate visits");

        const result = await response.json();

        if (result.success) {
          setVisits(result.data);
          setPagination({
            total: result.pagination.total,
            totalPages: result.pagination.totalPages,
          });
        } else {
          throw new Error(result.error || "Failed to fetch subordinate visits");
        }
      } catch (err: any) {
        console.error("Error:", err);
        setError(err.message || "An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Fetch all subordinates once on mount — independent of date range / visits
  useEffect(() => {
    const fetchSubordinates = async () => {
      try {
        const res = await fetch('/api/executive/my-subordinates', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.subordinates)) {
          setSubordinateList(data.subordinates);
        }
      } catch (err) {
        console.error('Failed to fetch subordinate list:', err);
      }
    };
    fetchSubordinates();
  }, []);

  useEffect(() => {
    fetchSubordinateVisits(dateRange, currentPage);
  }, [dateRange, currentPage, fetchSubordinateVisits]);

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    setCurrentPage(1); // reset to page 1 on range change
    setSelectedExecutive("All");
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        range: dateRange,
        type: visitType,
        executive: selectedExecutive,
      });
      const res = await fetch(
        `/api/executive/subordinate-visits/export?${params}`,
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || "SubordinateVisits.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Build executive dropdown options from the dedicated subordinate list
  // so that all subordinates appear even without visits in the selected range.
  // Fall back to deriving from visit data if the list hasn't loaded yet.
  const executives = useMemo(() => {
    if (subordinateList.length > 0) {
      return ["All", ...subordinateList.map((s) => s.name)];
    }
    // Fallback: derive from loaded visits while the list is loading
    const names = Array.from(new Set(visits.map((v) => v.representative)));
    return ["All", ...names.sort()];
  }, [subordinateList, visits]);

  // Derive unique cities from loaded data
  const cities = useMemo(() => {
    const citySet = Array.from(
      new Set(visits.map((v) => v.city).filter(Boolean)),
    );
    return ["All", ...citySet.sort()];
  }, [visits]);

  // Client-side filter by executive + city + type + search
  const filteredVisits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visits.filter((visit) => {
      const matchExecutive =
        selectedExecutive === "All" ||
        visit.representative === selectedExecutive;
      const matchCity = selectedCity === "All" || visit.city === selectedCity;
      const matchType = visit.type === visitType;
      const matchSearch =
        !q ||
        visit.storeName.toLowerCase().includes(q) ||
        visit.partnerBrand.toLowerCase().includes(q);
      return matchExecutive && matchCity && matchType && matchSearch;
    });
  }, [visits, selectedExecutive, selectedCity, visitType, searchQuery]);

  const getBrandColor = (brand: string): string => {
    const baseBrand = brand.split("(")[0].trim();
    const brandColors: Record<string, string> = {
      Samsung: "#1DB584",
      Vivo: "#8B5CF6",
      Oppo: "#F97316",
      OnePlus: "#1DB584",
      Realme: "#EC4899",
      Xiaomi: "#EF4444",
      Godrej: "#3B82F6",
      Havells: "#F59E0B",
      Philips: "#10B981",
    };
    return brandColors[baseBrand] || "#64748b";
  };

  const formatVisitDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="sub-visits-container">
      {/* Header */}
      <div className="sub-visits-header">
        <button onClick={() => router.back()} className="sub-visits-back-btn">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </button>
        <h1 className="sub-visits-title">Subordinate Visits</h1>
        <p className="sub-visits-subtitle">
          View and monitor your team's activities
        </p>
      </div>

      <div className="sub-visits-content">
        {/* Removed date range bar as it's now in filters */}

        {isLoading ? (
          <div className="sub-visits-loading">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p>Loading team visits...</p>
          </div>
        ) : error ? (
          <div className="sub-visits-error">
            <p>{error}</p>
            <button
              onClick={() => fetchSubordinateVisits(dateRange, currentPage)}
              className="mt-4 px-5 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        ) : visits.length === 0 ? (
          <div className="sub-visits-empty">
            <div className="text-5xl mb-4">📭</div>
            <h3>No visits found</h3>
            <p>
              No visits recorded for{" "}
              {DATE_RANGE_LABELS[dateRange].toLowerCase()}.
            </p>
          </div>
        ) : (
          <div className="sub-visits-dashboard">
            {/* Filters Section — dropdown style */}
            <div className="sub-visits-filters-bar">
              {/* Search */}
              <div className="svf-item svf-search">
                <label className="svf-label">Search Store / Brand</label>
                <div className="sub-visits-search-wrapper">
                  <Search className="sub-visits-search-icon" />
                  <input
                    type="text"
                    className="sub-visits-search-input"
                    placeholder="Type store name or brand..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="sub-visits-search-clear"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Date Range dropdown */}
              <div className="svf-item">
                <label className="svf-label">Date Range</label>
                <select
                  className="svf-select"
                  value={dateRange}
                  onChange={(e) =>
                    handleDateRangeChange(e.target.value as DateRange)
                  }
                >
                  {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(
                    (range) => (
                      <option key={range} value={range}>
                        {DATE_RANGE_LABELS[range]}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* Visit Type dropdown */}
              <div className="svf-item">
                <label className="svf-label">Visit Type</label>
                <select
                  className="svf-select"
                  value={visitType}
                  onChange={(e) =>
                    setVisitType(e.target.value as "Physical" | "Digital")
                  }
                >
                  <option value="Physical">Physical</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              {/* Subordinate dropdown */}
              <div className="svf-item">
                <label className="svf-label">Filter by Subordinate</label>
                <select
                  className="svf-select"
                  value={selectedExecutive}
                  onChange={(e) => setSelectedExecutive(e.target.value)}
                >
                  {executives.map((exec) => (
                    <option key={exec} value={exec}>
                      {exec}
                    </option>
                  ))}
                </select>
              </div>

              {/* City dropdown */}
              <div className="svf-item">
                <label className="svf-label">Filter by City</label>
                <select
                  className="svf-select"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                >
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Header — only title + Export button */}
            <div className="sub-visits-results-header">
              <h3>{visitType} Visits</h3>
              <button
                onClick={handleExport}
                disabled={isExporting || filteredVisits.length === 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.85rem",
                  borderRadius: "8px",
                  backgroundColor: isExporting ? "#d1fae5" : "#10b981",
                  color: "#fff",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: isExporting ? "not-allowed" : "pointer",
                  opacity: filteredVisits.length === 0 ? 0.5 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {isExporting ? (
                  <>
                    <Loader2
                      style={{
                        width: 14,
                        height: 14,
                        animation: "spin 1s linear infinite",
                      }}
                    />{" "}
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download style={{ width: 14, height: 14 }} /> Export Excel
                  </>
                )}
              </button>
            </div>

            {filteredVisits.length === 0 ? (
              <div className="sub-visits-empty-filter">
                <div className="text-3xl mb-3 text-gray-300">🔍</div>
                <p>
                  No {visitType.toLowerCase()} visits found for{" "}
                  {selectedExecutive === "All"
                    ? "any executive"
                    : selectedExecutive}
                  .
                </p>
              </div>
            ) : (
              <div className="evr-table-section">
                <div className="evr-table">
                  <div
                    className={`evr-table-header sub-visits-custom-grid ${selectedExecutive === "All" ? "with-exec" : "without-exec"}`}
                  >
                    {selectedExecutive === "All" && (
                      <div className="evr-header-cell">EXECUTIVE</div>
                    )}
                    <div className="evr-header-cell">STORE NAME</div>
                    <div className="evr-header-cell">BRANDS</div>
                    <div
                      className="evr-header-cell"
                      style={{ justifyContent: "center" }}
                    >
                      VISIT DATE
                    </div>
                    <div
                      className="evr-header-cell"
                      style={{ fontSize: "0.65rem", marginRight: "0.5rem" }}
                    >
                      ISSUES
                    </div>
                    <div className="evr-header-cell">ACTIONS</div>
                  </div>

                  <div className="evr-table-body">
                    {filteredVisits.map((visit) => (
                      <div
                        key={visit.id}
                        className={`evr-table-row sub-visits-custom-grid ${selectedExecutive === "All" ? "with-exec" : "without-exec"}`}
                      >
                        {/* 1. Executive (Conditional) */}
                        {selectedExecutive === "All" && (
                          <div
                            className="evr-cell"
                            data-label="EXECUTIVE"
                            style={{ paddingLeft: 0 }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                color: "#1e293b",
                                fontSize: "0.75rem",
                              }}
                            >
                              {visit.representative.split(" ")[0]}
                            </span>
                          </div>
                        )}

                        {/* 2. Store Name */}
                        <div
                          className="evr-cell evr-store-name-cell"
                          data-label="STORE NAME"
                        >
                          <span
                            className="evr-store-name-link"
                            style={{ cursor: "default", color: "#111827" }}
                          >
                            {visit.storeName}
                          </span>
                        </div>

                        {/* 3. Partner Brands */}
                        <div
                          className="evr-cell evr-partner-brands-cell"
                          data-label="BRANDS"
                        >
                          {visit.partnerBrand &&
                          visit.partnerBrand !== "N/A" ? (
                            visit.partnerBrand.split(",").map((brand, i) => (
                              <span
                                key={i}
                                className="evr-brand-tag"
                                style={{
                                  backgroundColor: getBrandColor(brand.trim()),
                                }}
                              >
                                {brand.trim()}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: "#9ca3af" }}>N/A</span>
                          )}
                        </div>

                        {/* 4. Visit Date */}
                        <div
                          className="evr-cell evr-date-cell"
                          data-label="VISIT DATE"
                          style={{
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <span className="evr-visit-date">
                            {formatVisitDate(visit.date)}
                          </span>
                        </div>

                        {/* 5. Issues */}
                        <div
                          className="evr-cell evr-issues-cell"
                          data-label="ISSUES"
                        >
                          {visit.issues && visit.issues.length > 0 ? (
                            <span
                              className="evr-has-issues"
                              onClick={() => setSelectedVisit(visit)}
                              style={{
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                              title="Click to view issue details"
                            >
                              Yes ({visit.issues.length})
                            </span>
                          ) : (
                            <span className="evr-no-issues">None</span>
                          )}
                        </div>

                        {/* 6. Actions */}
                        <div
                          className="evr-cell evr-actions-cell"
                          data-label="ACTIONS"
                        >
                          <div
                            className="evr-action-buttons-group"
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.4rem",
                              width: "100%",
                            }}
                          >
                            <button
                              className="evr-view-details-btn"
                              style={{
                                backgroundColor: "#6366f1",
                                color: "#ffffff",
                                borderRadius: "6px",
                                fontWeight: 600,
                                width: "100%",
                                padding: "0.4rem 0.5rem",
                                border: "none",
                              }}
                              onClick={() => setSelectedVisit(visit)}
                            >
                              View Details
                            </button>
                            <button
                              className="evr-view-details-btn"
                              style={{
                                backgroundColor: "#ef4444",
                                color: "#ffffff",
                                borderRadius: "6px",
                                fontWeight: 600,
                                width: "100%",
                                padding: "0.4rem 0.5rem",
                                border: "none",
                              }}
                              onClick={() =>
                                router.push(
                                  `/executive/sales?storeId=${visit.storeId}&store=${encodeURIComponent(visit.storeName)}`,
                                )
                              }
                            >
                              Sales
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="sub-visits-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === pagination.totalPages ||
                      Math.abs(p - currentPage) <= 1,
                  )
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
                      acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="pagination-ellipsis"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        className={`pagination-btn ${currentPage === item ? "active" : ""}`}
                        onClick={() => handlePageChange(item as number)}
                      >
                        {item}
                      </button>
                    ),
                  )}

                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <span className="pagination-info">
                  {filteredVisits.length} shown · Page {currentPage} of{" "}
                  {pagination.totalPages} · {pagination.total} total records
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visit Details Modal */}
      {selectedVisit && (
        <VisitDetailsModal
          isOpen={!!selectedVisit}
          onClose={() => setSelectedVisit(null)}
          visit={{
            id: selectedVisit.id as unknown as number,
            executiveName: selectedVisit.representative,
            executiveInitials: selectedVisit.representative
              .substring(0, 2)
              .toUpperCase(),
            avatarColor: "#1DB584",
            storeName: selectedVisit.storeName,
            partnerBrand:
              selectedVisit.partnerBrand !== "N/A"
                ? selectedVisit.partnerBrand.split(",").map((b) => b.trim())
                : [],
            visitDate: selectedVisit.date || selectedVisit.visitDate,
            visitStatus: selectedVisit.status as any,
            reviewerName: selectedVisit.reviewerName,
            issueStatus: (selectedVisit.issues &&
            selectedVisit.issues.length > 0
              ? selectedVisit.issues[0].status
              : "Pending") as any,
            city: "N/A",
            issues:
              selectedVisit.issues && selectedVisit.issues.length > 0
                ? selectedVisit.issues[0].details
                : "None",
            issueId:
              selectedVisit.issues && selectedVisit.issues.length > 0
                ? (selectedVisit.issues[0].id as unknown as number)
                : undefined,
            feedback: selectedVisit.remarks || "No feedback provided",
            POSMchecked: selectedVisit.POSMchecked,
            peopleMet: selectedVisit.personMet,
            imageUrls: selectedVisit.imageUrls || [],
            brandVisitDetails: selectedVisit.brandVisitDetails || [],
          }}
          isDigital={selectedVisit.type === "Digital"}
        />
      )}
    </div>
  );
}
