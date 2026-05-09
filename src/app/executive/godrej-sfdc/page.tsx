"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import "./godrej-sfdc.css";

interface GodrejSFDCRecord {
  id: string;
  planId: string;
  phone: string;
  contractBookingId: string;
  customerName?: string | null;
  uploadedAt: string;
}

const GodrejSFDCPage: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GodrejSFDCRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 50;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        });

        const response = await fetch(`/api/executive/godrej-sfdc?${queryParams.toString()}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setData(result.data);
          if (result.pagination) {
            setTotalPages(result.pagination.totalPages);
            setTotalRecords(result.pagination.total);
          }
        } else {
          throw new Error(
            result.message || result.error || "Failed to fetch data",
          );
        }
      } catch (err) {
        console.error("Error fetching Godrej SFDC data:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [page, debouncedSearchTerm]);

  return (
    <div className="godrej-page-container">
      <div className="godrej-page-header">
        <button onClick={() => router.back()} className="godrej-back-button">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 12H5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 19L5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        <h1 className="godrej-page-title">Godrej SFDC Data</h1>
      </div>

      <div className="godrej-page-content">
        {isLoading ? (
          <div className="godrej-loading-state">
            <div className="godrej-spinner"></div>
            <span>Loading your records...</span>
          </div>
        ) : error ? (
          <div className="godrej-error-state">
            <span className="godrej-error-icon">⚠️</span>
            <p className="godrej-error-text">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="godrej-retry-button"
            >
              Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="godrej-empty-state">
            <div className="godrej-empty-icon">📁</div>
            <h3>No Records Found</h3>
            <p>
              You don't have any Godrej SFDC data synced to your account yet.
            </p>
          </div>
        ) : (
          <>
            <div className="godrej-search-bar-wrapper">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by Plan Id, Phone, ContractBookingID or Customer Name"
                className="godrej-search-input"
              />
            </div>
            <div className="godrej-table-container">
              <table className="godrej-data-table">
                <thead>
                  <tr>
                    <th>Plan Id</th>
                    <th>Phone</th>
                    <th>ContractBookingID</th>
                    <th>Customer Name</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No matching records found.</td>
                    </tr>
                  ) : (
                    data.map((record) => (
                      <tr key={record.id}>
                        <td>{record.planId}</td>
                        <td>{record.phone}</td>
                        <td>{record.contractBookingId}</td>
                        <td>{record.customerName ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} records
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', backgroundColor: page === 1 ? 'var(--background)' : 'var(--surface)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page === totalPages}
                    style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', backgroundColor: page === totalPages ? 'var(--background)' : 'var(--surface)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GodrejSFDCPage;
