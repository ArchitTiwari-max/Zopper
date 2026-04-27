import React, { useState, useEffect } from 'react';
import './SuggestPJP.css'; // Reusing some base modal styles

interface SubmittedStore {
    id: string;
    storeName: string;
    city: string;
}

interface SubmittedPlan {
    id: string;
    plannedVisitDate: string;
    submittedAt: string;
    status: string;
    stores: SubmittedStore[];
}

interface SubmittedPJPModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SubmittedPJPModal: React.FC<SubmittedPJPModalProps> = ({ isOpen, onClose }) => {
    const [plans, setPlans] = useState<SubmittedPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

    // Deviation state
    const [deviationData, setDeviationData] = useState<{ hasDeviation: boolean, planId?: string, pjpNotFollowedReason?: string } | null>(null);
    const [deviationReason, setDeviationReason] = useState('');
    const [submittingDeviation, setSubmittingDeviation] = useState(false);
    const [deviationSuccess, setDeviationSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPlans();
            fetchDeviation();
        }
    }, [isOpen]);

    const fetchDeviation = async () => {
        try {
            const res = await fetch('/api/executive/pjp-deviation');
            if (res.ok) {
                const data = await res.json();
                if (data && data.hasDeviation) {
                    setDeviationData(data);
                    if (data.pjpNotFollowedReason) {
                        setDeviationReason(data.pjpNotFollowedReason);
                        setDeviationSuccess(true);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching deviation:', err);
        }
    };

    const handleSubmitDeviation = async (planId: string) => {
        if (!deviationReason.trim()) return;
        setSubmittingDeviation(true);
        try {
            const res = await fetch('/api/executive/pjp-deviation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, reason: deviationReason })
            });
            if (res.ok) {
                setDeviationSuccess(true);
            } else {
                alert('Failed to submit reason');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to submit reason');
        } finally {
            setSubmittingDeviation(false);
        }
    };

    const fetchPlans = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/executive/visit-plan');
            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Failed to fetch' }));
                throw new Error(errData.error || `HTTP error ${res.status}`);
            }
            const data = await res.json();
            if (data.success) {
                setPlans(data.data);
            }
        } catch (err) {
            console.error('Error fetching plans:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch visit plans');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="spjp-overlay">
            <div className="spjp-step1-modal" style={{ maxWidth: '600px', width: '95%' }}>
                <div className="spjp-step1-header" style={{ paddingBottom: '16px', borderBottom: '1px solid #e9ecef' }}>
                    <div className="spjp-modal-title-group">
                        <h2 className="spjp-step1-title">📋 Submitted PJPs</h2>
                        <p className="spjp-step1-subtitle">History of your submitted visit plans</p>
                    </div>
                    <button className="spjp-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="spjp-step1-list" style={{ maxHeight: '70vh', padding: '16px' }}>
                    {loading ? (
                        <div className="spjp-loading-container" style={{ padding: '40px', textAlign: 'center' }}>
                            <div className="spjp-spinner" style={{ margin: '0 auto 12px', width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1' }}></div>
                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Fetching your plans...</p>
                        </div>
                    ) : error ? (
                        <div className="spjp-error-state" style={{ padding: '40px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                            <p style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</p>
                            <button
                                onClick={fetchPlans}
                                style={{
                                    padding: '8px 20px',
                                    background: '#6366f1',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="spjp-empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.5 }}>📋</div>
                            <p style={{ color: '#64748b', fontWeight: '500' }}>No submitted plans found.</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>Submit a visit plan using "Create PJP" or "Suggest PJP" to see it here.</p>
                        </div>
                    ) : (
                        <div className="spjp-plans-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {plans.map(plan => (
                                <div key={plan.id} className="spjp-plan-card" style={{
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <div
                                        onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                                        style={{
                                            padding: '16px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: expandedPlanId === plan.id ? '#f8fafc' : 'white'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1e293b' }}>
                                                📅 {new Date(plan.plannedVisitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                Submitted on {new Date(plan.submittedAt).toLocaleDateString()} · {plan.stores.length} stores
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                textTransform: 'uppercase',
                                                background: plan.status === 'COMPLETED' ? '#dcfce7' : '#fef9c3',
                                                color: plan.status === 'COMPLETED' ? '#166534' : '#854d0e'
                                            }}>
                                                {plan.status}
                                            </span>
                                            <span style={{ transform: expandedPlanId === plan.id ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                        </div>
                                    </div>

                                    {expandedPlanId === plan.id && (
                                        <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                                            
                                            {/* Deviation Banner */}
                                            {deviationData?.hasDeviation && deviationData.planId === plan.id && (
                                                <div style={{ marginTop: '16px', padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#b45309' }}>⚠️ PJP Mismatch Detected</h3>
                                                    <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#92400e' }}>
                                                        Your actual visited stores today do not match this submitted PJP. Please provide a reason:
                                                    </p>
                                                    <textarea
                                                        style={{ width: '100%', padding: '8px', border: '1px solid #fcd34d', borderRadius: '4px', fontSize: '13px', minHeight: '60px', marginBottom: '8px', outline: 'none' }}
                                                        placeholder="Enter reason here..."
                                                        value={deviationReason}
                                                        onChange={(e) => {
                                                            setDeviationReason(e.target.value);
                                                            setDeviationSuccess(false);
                                                        }}
                                                        disabled={submittingDeviation}
                                                    />
                                                    <button
                                                        onClick={() => handleSubmitDeviation(plan.id)}
                                                        disabled={!deviationReason.trim() || submittingDeviation || deviationSuccess}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: deviationSuccess ? '#10b981' : '#f59e0b',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            fontSize: '13px',
                                                            cursor: (deviationSuccess || !deviationReason.trim()) ? 'not-allowed' : 'pointer',
                                                            opacity: (!deviationReason.trim() || submittingDeviation) ? 0.7 : 1
                                                        }}
                                                    >
                                                        {submittingDeviation ? 'Saving...' : deviationSuccess ? '✓ Saved' : 'Save Reason'}
                                                    </button>
                                                </div>
                                            )}

                                            <div style={{ marginTop: '16px' }}>
                                                <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Visit Sequence
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {plan.stores.map((store, idx) => (
                                                        <div key={`${plan.id}-${store.id}-${idx}`} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            padding: '8px',
                                                            background: '#f8fafc',
                                                            borderRadius: '8px'
                                                        }}>
                                                            <div style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '50%',
                                                                background: '#6366f1',
                                                                color: 'white',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '700'
                                                            }}>
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#334155' }}>{store.storeName}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {store.city}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="spjp-modal-footer">
                    <button className="spjp-footer-btn secondary" onClick={onClose} style={{ width: '100%' }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubmittedPJPModal;
