"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import VisitDetailsModal from "../../components/VisitDetailsModal";

interface VisitCardData {
  id: string;
  executiveId: string;
  executiveName: string;
  executiveInitials: string;
  avatarColor: string;
  storeName: string;
  storeId: string;
  partnerBrand: string[];
  visitDate: string; // dd/mm/yyyy already formatted by admin APIs
  visitStatus: "PENDING_REVIEW" | "REVIEWD";
  reviewerName?: string;
  issueStatus: "Pending" | "Assigned" | "Resolved" | null;
  city: string;
  issues: string;
  issueId?: string;
  feedback: string;
  POSMchecked: boolean | null;
  peopleMet?: Array<{ name: string; designation: string; phoneNumber?: string }>;
  imageUrls?: string[];
}

interface IssueItem {
  id: string;
  issueId: string;
  status: "Pending" | "Assigned" | "Resolved";
  dateReported: string; // dd/mm/yyyy
  reportedBy: string;
  brandAssociated: string;
  description: string;
}

const StoreVisitsPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const storeId = params?.id as string;
  const storeName = searchParams.get("storeName") || "Store";
  const city = searchParams.get("city") || "";

  const [digitalVisits, setDigitalVisits] = useState<VisitCardData[]>([]);
  const [physicalVisits, setPhysicalVisits] = useState<VisitCardData[]>([]);
  const [openIssues, setOpenIssues] = useState<IssueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVisit, setSelectedVisit] = useState<VisitCardData | null>(null);
  const [isDigitalSelected, setIsDigitalSelected] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchData = async () => {
    if (!storeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.append("dateFilter", "Last 90 Days");
      qs.append("storeId", storeId);

      // Fetch digital and physical in parallel
      const [digRes, phyRes, issuesRes] = await Promise.all([
        fetch(`/api/admin/digital-report/data?${qs.toString()}`, { credentials: "include" }),
        fetch(`/api/admin/visit-report/data?${qs.toString()}`, { credentials: "include" }),
        fetch(`/api/admin/issues/data?${new URLSearchParams({ dateFilter: 'Last 90 Days', storeId, status: 'Pending' }).toString()}`, { credentials: 'include' }),
      ]);

      if (!digRes.ok) {
        const err = await digRes.json().catch(() => ({ error: `Digital HTTP ${digRes.status}` }));
        throw new Error(err.error || `Digital HTTP ${digRes.status}`);
      }
      if (!phyRes.ok) {
        const err = await phyRes.json().catch(() => ({ error: `Physical HTTP ${phyRes.status}` }));
        throw new Error(err.error || `Physical HTTP ${phyRes.status}`);
      }
      if (!issuesRes.ok) {
        const err = await issuesRes.json().catch(() => ({ error: `Issues HTTP ${issuesRes.status}` }));
        throw new Error(err.error || `Issues HTTP ${issuesRes.status}`);
      }

      const digData = await digRes.json();
      const phyData = await phyRes.json();
      const issuesData = await issuesRes.json();

      setDigitalVisits((digData.visits || []).slice(0, 5));
      setPhysicalVisits((phyData.visits || []).slice(0, 5));
      setOpenIssues((issuesData.issues || []).filter((i: any) => i.status !== 'Resolved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load store visits");
      setDigitalVisits([]);
      setPhysicalVisits([]);
      setOpenIssues([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const getStatusColor = (status: string) => {
    switch ((status || "").toUpperCase()) {
      case "PENDING_REVIEW":
        return "#f59e0b";
      case "REVIEWD":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  const getIssueColor = (status: string | null) => {
    switch ((status || '').toLowerCase()) {
      case 'pending':
        return '#ef4444';
      case 'assigned':
        return '#f59e0b';
      case 'resolved':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const openDetails = (visit: VisitCardData, isDigital: boolean) => {
    setSelectedVisit(visit);
    setIsDigitalSelected(isDigital);
    setShowModal(true);
  };
  const closeDetails = () => {
    setShowModal(false);
    setSelectedVisit(null);
  };

  const Section: React.FC<{ title: string; visits: VisitCardData[]; isDigital: boolean }> = ({ title, visits, isDigital }) => (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>{title}</h3>
      {isLoading ? (
        <div style={{ padding: 16, color: "#6b7280" }}>Loading...</div>
      ) : visits.length === 0 ? (
        <div style={{ padding: 16, color: "#6b7280" }}>No visits found.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {visits.map((v) => (
            <div key={v.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 600 }}>{v.visitDate}</div>
                <span style={{ background: getStatusColor(v.visitStatus), color: "#fff", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>
                  {v.visitStatus === "REVIEWD" ? "REVIEWED" : v.visitStatus}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: v.avatarColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{v.executiveInitials}</div>
                <div style={{ fontSize: 13 }}>{v.executiveName}</div>
              </div>
              {v.feedback && v.feedback !== "No feedback provided" && (
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{v.feedback}</div>
              )}
              {v.peopleMet && v.peopleMet.length > 0 && (
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                  <strong>Contact:</strong> {v.peopleMet.map((p, i) => `${p.name} (${p.designation})${p.phoneNumber ? ` - ${p.phoneNumber}` : ""}`).join(", ")}
                </div>
              )}

              {/* Issue block */}
              {((v.issues && v.issues !== 'None') || v.issueStatus) && (
                <div style={{ marginTop: 6, padding: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Issue</div>
                    {v.issueStatus && (
                      <span style={{ background: getIssueColor(v.issueStatus), color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>
                        {v.issueStatus}
                      </span>
                    )}
                  </div>
                  {v.issues && v.issues !== 'None' && (
                    <div style={{ fontSize: 12, color: '#4b5563' }}>{v.issues}</div>
                  )}
                </div>
              )}

              {v.partnerBrand && v.partnerBrand.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {v.partnerBrand.map((b, i) => (
                    <span key={i} style={{ background: "#e5e7eb", color: "#111827", borderRadius: 999, padding: "2px 8px", fontSize: 11 }}>{b}</span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => openDetails(v, isDigital)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => router.push("/admin/stores")} style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer" }}>← Back to Stores</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
        <h2 style={{ margin: 0 }}>{storeName}</h2>
        {city && <div style={{ color: "#6b7280", marginTop: 4 }}>{city}</div>}
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "#dc2626" }}>{error}</div>
      )}


      <Section title="Last 5 Digital Visits" visits={digitalVisits} isDigital={true} />
      <Section title="Last 5 Physical Visits" visits={physicalVisits} isDigital={false} />

      {/* Open Issues Card */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>Open Issues</h3>
        {isLoading ? (
          <div style={{ padding: 16, color: '#6b7280' }}>Loading...</div>
        ) : openIssues.length === 0 ? (
          <div style={{ padding: 16, color: '#6b7280' }}>No open issues.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {openIssues.map((iss) => (
              <div key={iss.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>#{iss.issueId}</div>
                  <span style={{ background: getIssueColor(iss.status), color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{iss.status}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Reported: {iss.dateReported} • By: {iss.reportedBy}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Brand: {iss.brandAssociated}</div>
                {iss.description && (
                  <div style={{ fontSize: 13, color: '#374151' }}>{iss.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <VisitDetailsModal isOpen={showModal} onClose={closeDetails} visit={selectedVisit as any} isDigital={isDigitalSelected} />
    </div>
  );
};

export default StoreVisitsPage;
