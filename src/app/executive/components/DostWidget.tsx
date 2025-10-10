"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import "./DostWidget.css";

interface DostStoreSuggestion {
  storeId: string;
  storeName: string;
  city?: string | null;
  brandFocus: string[];
  reason: string;
  priority: "high" | "medium" | "low";
}

interface DostDiscussionPoint {
  storeId: string | null;
  topic: string;
  reason: string;
  urgency: "high" | "medium" | "low";
}

interface DostPerformanceInsight {
  metric: string;
  finding: string;
  suggestion: string;
  severity: "high" | "medium" | "low";
}

interface DostAnswer { question: string; answer: string }

interface DostSuggestionsData {
  storesToVisit: DostStoreSuggestion[];
  discussionPoints: DostDiscussionPoint[];
  performanceInsights: DostPerformanceInsight[];
  generatedAt: string;
  answer?: DostAnswer;
}

interface DostSuggestionsResponse {
  success: boolean;
  data: DostSuggestionsData;
  error?: string;
}

const bubbleStyle: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 84, // sits just above bottom nav
  zIndex: 50,
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 84 + 56, // above the bubble and footer
  width: 360,
  maxWidth: "calc(100vw - 24px)",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 12px 24px rgba(0,0,0,0.14)",
  overflow: "hidden",
  zIndex: 60,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  background: "#f9fafb",
  borderBottom: "1px solid #eef2f7",
  fontWeight: 600,
};

const bodyStyle: React.CSSProperties = {
  padding: 12,
  maxHeight: 340,
  overflowY: "auto",
  display: "grid",
  gap: 10,
};

const inputBarStyle: React.CSSProperties = {
  padding: 10,
  borderTop: "1px solid #eef2f7",
  display: "flex",
  gap: 8,
};

const pill: React.CSSProperties = {
  display: "inline-block",
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#374151",
};

export default function DostWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DostSuggestionsData | null>(null);
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cookie utilities to scope storage by user
  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(";").shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
  };

  const getUserKeySuffix = () => {
    try {
      const userInfo = getCookie("userInfo");
      if (!userInfo) return "unknown";
      const parsed = JSON.parse(userInfo);
      return parsed?.userId || parsed?.id || "unknown";
    } catch {
      return "unknown";
    }
  };

  const lastSeenKey = `dost:lastSeen:${getUserKeySuffix()}`;
  const historyKey = `dost:history:${getUserKeySuffix()}`;

  const saveHistory = (question: string, response: DostSuggestionsData) => {
    try {
      const existingRaw = localStorage.getItem(historyKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.unshift({ question, response, at: new Date().toISOString() });
      localStorage.setItem(historyKey, JSON.stringify(existing.slice(0, 20)));
    } catch {}
  };

  const markSeen = (generatedAt: string | undefined) => {
    try {
      if (generatedAt) localStorage.setItem(lastSeenKey, generatedAt);
      setUnread(false);
    } catch {}
  };

  const fetchDost = async (question?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/executive/dost${question ? `?q=${encodeURIComponent(question)}` : ""}`;
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DostSuggestionsResponse = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load suggestions");
      setData(json.data);
      // Refresh history after a successful ask
      try { await fetchHistory(); } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  };

  const [history, setHistory] = useState<{ id: string; question: string; answerText: string | null; createdAt: string }[]>([]);

  const fetchHistory = async () => {
    const res = await fetch('/api/executive/dost/history?limit=10', { credentials: 'include' });
    if (!res.ok) return;
    const json = await res.json();
    if (json?.success) setHistory(json.data || []);
  };

  useEffect(() => {
    // Preload suggestions & history when opened the first time
    if (open) {
      if (!data && !loading) fetchDost();
      fetchHistory().catch(() => {});
    }
    // When opening, mark the latest as seen
    if (open && data?.generatedAt) {
      markSeen(data.generatedAt);
    }
  }, [open]);

  const onAsk = async () => {
    if (!q.trim()) {
      // If empty query, refresh general suggestions
      await fetchDost();
      return;
    }
    const current = q;
    setQ("");
    await fetchDost(current);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onAsk();
    }
  };

  // Format long reasons as bullet points if they contain enumerations
  const toBulletItems = (text: string): string[] => {
    if (!text) return []
    const normalized = text
      .replace(/(\s|^)(\d+[\.\)])\s+/g, '\n$2 ') // turn " 1." into newline
      .replace(/•/g, '\n• ') // bullet char to newline
      .replace(/;/g, '\n') // semicolons to newline
    const items = normalized.split(/\n+/).map(s => s.trim()).filter(Boolean)
    // If splitting didn't help (only 1 item), return empty to indicate paragraph
    return items.length > 1 ? items : []
  }

  return (
    <>
      {/* Bubble button */}
      <div className="dost-bubble">
        <button
          onClick={() => setOpen(!open)}
          aria-label="Open Dost"
          className="dost-bubble-button"
        >
          <span className="dost-bubble-emoji">🤖</span>
          {unread && <span className="dost-bubble-dot" aria-label="Unread" />}
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="dost-panel">
          <div className="dost-header">
            <span>AI Suggestions by Dost</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="dost-close"
            >
              ✕
            </button>
          </div>

          <div className="dost-body">
            {loading && !data ? (
              <div className="dost-loading">
                <div className="loading-spinner-large" />
                <span>Loading…</span>
              </div>
            ) : error ? (
              <div className="dost-error">Error: {error}</div>
            ) : data ? (
              <>
                {/* Latest Answer */}
                {data.answer && (
                  <div className="dost-card">
                    <div className="dost-section-title" style={{ marginBottom: 4 }}>Latest Answer</div>
                    <div className="dost-subtle" style={{ marginBottom: 6 }}>Q: {data.answer.question}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{data.answer.answer}</div>
                  </div>
                )}

                <div>
                  <div className="dost-section-title">Next Best Stores</div>
                  {data.storesToVisit.length === 0 ? (
                    <div className="dost-muted">No suggestions</div>
                  ) : (
                    <div className="dost-list">
                      {data.storesToVisit.map((s) => (
                        <div key={s.storeId} className="dost-card">
                          <div className="dost-card-head">
                            <div className="dost-card-left">
                              <div className="dost-avatar">{s.storeName?.charAt(0)?.toUpperCase()}</div>
                              <div>
                                <div className="dost-strong">{s.storeName}</div>
                                <div className="dost-subtle">{s.city || ""}</div>
                              </div>
                            </div>
                            <span className="dost-pill">{s.priority.toUpperCase()}</span>
                          </div>
                          <div className="dost-reason">{s.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="dost-section-title">Discussion Points</div>
                  {data.discussionPoints.length === 0 ? (
                    <div className="dost-muted">None</div>
                  ) : (
                    <div className="dost-list">
                      {data.discussionPoints.map((d, i) => {
                        const points = toBulletItems(d.reason)
                        return (
                          <div key={i} className="dost-card">
                            <div className="dost-strong" style={{ marginBottom: 4 }}>
                              {d.topic}
                              {d.storeId ? (
                                <>
                                  {' '}
                                  <button
                                    onClick={() => router.push(`/executive/visit-history?storeId=${encodeURIComponent(d.storeId)}`)}
                                    className="dost-link"
                                    style={{ marginLeft: 6 }}
                                  >
                                    {d.storeName || d.storeId}
                                  </button>
                                </>
                              ) : null}
                            </div>
                            {points.length > 0 ? (
                              <ul className="dost-ul">
                                {points.map((p, idx) => (
                                  <li key={idx}>{p}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="dost-reason">{d.reason}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="dost-section-title">Performance Insights</div>
                  {data.performanceInsights.length === 0 ? (
                    <div className="dost-muted">None</div>
                  ) : (
                    <ul className="dost-ul">
                      {data.performanceInsights.map((p, i) => (
                        <li key={i}>
                          <strong>{p.metric}:</strong> {p.finding} — <em>{p.suggestion}</em>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="dost-timestamp">Generated at {new Date(data.generatedAt).toLocaleString()}</div>

                {/* History */}
                {history.length > 0 && (
                  <div className="dost-card">
                    <div className="dost-section-title" style={{ marginBottom: 6 }}>Recent Questions</div>
                    <ul className="dost-ul">
                      {history.map(h => (
                        <li key={h.id}>
                          <span className="dost-subtle">{new Date(h.createdAt).toLocaleString()} — </span>
                          <strong>Q:</strong> {h.question}
                          {h.answerText ? <span> — {h.answerText}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="dost-muted">Open Dost to generate suggestions</div>
            )}
          </div>

          <div className="dost-inputbar">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask Dost (e.g., Which store should I visit today?)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              className="dost-input"
            />
            <button
              onClick={onAsk}
              disabled={loading}
              className="exec-dash-view-all-btn dost-ask-btn"
            >
              {loading ? "Sending…" : "Ask"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
