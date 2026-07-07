'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import '../executive-form/ExecutiveForm.css';
import StakeholderVisitDetailsModal from '../components/StakeholderVisitDetailsModal';

interface PersonMet {
  name: string;
  designation: string;
  phoneNumber: string;
}

interface UploadedImage {
  url: string;
  public_id: string;
  bytes: number;
  format: string;
}

interface PastVisit {
  id: string;
  visitDate: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  personMet: PersonMet[];
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  createdAt: string;
  executive?: {
    name: string;
  }
}

const StakeholderVisitFormContent: React.FC = () => {
  const router = useRouter();
  const [brandId, setBrandId] = useState('');
  const [brandName, setBrandName] = useState('');
  const [availableBrands, setAvailableBrands] = useState<any[]>([]);
  const [allDesignations, setAllDesignations] = useState<any[]>([]);

  const [stakeholderDesignation, setStakeholderDesignation] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [state, setState] = useState('');
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableDesignations, setAvailableDesignations] = useState<any[]>([]);
  const [nextScheduledDate, setNextScheduledDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [peopleMet, setPeopleMet] = useState<PersonMet[]>([]);
  const [currentPerson, setCurrentPerson] = useState({ name: '', designation: '', phoneNumber: '' });
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [issuesRaised, setIssuesRaised] = useState<string[]>([]);
  const [currentIssue, setCurrentIssue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [loadingPastVisits, setLoadingPastVisits] = useState(false);
  const [showPastVisits, setShowPastVisits] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<PastVisit | null>(null);

  // Set default visit date to today (IST)
  useEffect(() => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    setVisitDate(istDate.toISOString().split('T')[0]);

    // Fetch states and designations
    const fetchFormData = async () => {
      try {
        const res = await fetch('/api/executive/stakeholders', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableStates(data.states || []);
          setAvailableBrands(data.brands || []);
          setAllDesignations(data.stakeholders || []);
        }
      } catch (e) {
        console.error('Failed to fetch form data:', e);
      }
    };
    fetchFormData();
  }, []);

  // Update available designations when brand changes
  useEffect(() => {
    if (brandId && brandName) {
      const applicableDesignations = allDesignations.filter((s: any) => 
        s.brands.includes(brandName) || s.brands.includes(brandId)
      );
      setAvailableDesignations(applicableDesignations);
    } else {
      setAvailableDesignations([]);
    }
    setStakeholderDesignation(''); // Reset designation when brand changes
  }, [brandId, brandName, allDesignations]);

  // Fetch past visits for this stakeholder
  useEffect(() => {
    if (!brandName || !stakeholderDesignation) return;
    const fetchPastVisits = async () => {
      setLoadingPastVisits(true);
      try {
        const params = new URLSearchParams({
          brandName,
          stakeholderDesignation,
        });
        const res = await fetch(`/api/executive/stakeholder-visit?${params.toString()}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setPastVisits(data.visits || []);
        }
      } catch (e) {
        console.error('Failed to fetch past visits:', e);
      } finally {
        setLoadingPastVisits(false);
      }
    };
    fetchPastVisits();
  }, [brandName, stakeholderDesignation]);

  const addPerson = () => {
    if (!currentPerson.name.trim()) {
      setErrors(prev => ({ ...prev, personName: 'Person name is required' }));
      return;
    }
    setPeopleMet(prev => [...prev, { ...currentPerson }]);
    setCurrentPerson({ name: '', designation: '', phoneNumber: '' });
    setErrors(prev => { const e = { ...prev }; delete e.personName; return e; });
  };

  const removePerson = (index: number) => {
    setPeopleMet(prev => prev.filter((_, i) => i !== index));
  };

  const addIssue = () => {
    if (currentIssue.trim()) {
      setIssuesRaised(prev => [...prev, currentIssue.trim()]);
      setCurrentIssue('');
    }
  };

  const removeIssue = (index: number) => {
    setIssuesRaised(prev => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!brandId) newErrors.brand = 'Brand is required';
    if (!stakeholderDesignation) newErrors.stakeholderDesignation = 'Designation is required';
    if (!visitDate) newErrors.visitDate = 'Visit date is required';
    if (!state.trim()) newErrors.state = 'State is required';
    if (peopleMet.length === 0) newErrors.peopleMet = 'Please add at least one person met';
    if (!remarks.trim()) newErrors.remarks = 'Remarks are required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        brandId,
        stakeholderDesignation,
        state,
        visitDate,
        personMet: peopleMet,
        remarks,
        issuesRaised,
        imageUrls: uploadedImages.map(img => img.url),
        nextScheduledDate: nextScheduledDate || null,
      };

      const res = await fetch('/api/executive/stakeholder-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          alert('✅ Stakeholder visit submitted successfully!');
          router.push('/executive/store');
        } else {
          throw new Error(data.error || 'Failed to submit');
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit visit');
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Submission failed'}`);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
      
      {/* Page Heading */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
          🤝 Stakeholder Connect
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
          Log your visit and interactions with stakeholders
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
              Select Brand
            </label>
            <select
              value={brandId}
              onChange={(e) => {
                const selected = availableBrands.find(b => b.id === e.target.value);
                setBrandId(e.target.value);
                setBrandName(selected ? selected.brandName : '');
              }}
              style={{
                width: '100%', padding: '0.625rem 0.875rem', border: `1px solid ${errors.brand ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', background: 'white'
              }}
            >
              <option value="">Select Brand</option>
              {availableBrands.map(b => (
                <option key={b.id} value={b.id}>{b.brandName}</option>
              ))}
            </select>
            {errors.brand && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>{errors.brand}</p>}
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
              Stakeholder Designation
            </label>
            <select
              value={stakeholderDesignation}
              onChange={(e) => setStakeholderDesignation(e.target.value)}
              style={{
                width: '100%', padding: '0.625rem 0.875rem', border: `1px solid ${errors.stakeholderDesignation ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', background: 'white'
              }}
            >
              <option value="">Select Designation</option>
              {availableDesignations.map(dsg => (
                <option key={dsg.id} value={dsg.designation}>{dsg.designation}</option>
              ))}
            </select>
            {errors.stakeholderDesignation && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>{errors.stakeholderDesignation}</p>}
          </div>

          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#0369a1' }}>
              🤝 You are logging a <strong>Stakeholder Visit</strong> for this brand.
            </p>
          </div>
        </div>
      </div>



      {/* Visit Date */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>📅 Visit Date</h2>
        <input
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          style={{
            width: '100%', padding: '0.625rem 0.875rem', border: `1px solid ${errors.visitDate ? '#ef4444' : '#d1d5db'}`,
            borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box'
          }}
        />
        {errors.visitDate && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>{errors.visitDate}</p>}
      </div>

      {/* State */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>📍 State</h2>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          style={{
            width: '100%', padding: '0.625rem 0.875rem', border: `1px solid ${errors.state ? '#ef4444' : '#d1d5db'}`,
            borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', background: 'white'
          }}
        >
          <option value="">Select State</option>
          {availableStates.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {errors.state && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>{errors.state}</p>}
      </div>

      {/* People Met */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>👤 People Met</h2>

        {/* Added People */}
        {peopleMet.length > 0 && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {peopleMet.map((person, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div>
                  <span style={{ fontWeight: '600', color: '#166534', fontSize: '0.875rem' }}>{person.name}</span>
                  {person.designation && <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}> — {person.designation}</span>}
                  {person.phoneNumber && <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}> | {person.phoneNumber}</span>}
                </div>
                <button onClick={() => removePerson(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Add Person Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input
            placeholder="Name *"
            value={currentPerson.name}
            onChange={(e) => setCurrentPerson(p => ({ ...p, name: e.target.value }))}
            style={{ padding: '0.625rem 0.875rem', border: `1px solid ${errors.personName ? '#ef4444' : '#d1d5db'}`, borderRadius: '8px', fontSize: '0.875rem' }}
          />
          <input
            placeholder="Designation"
            value={currentPerson.designation}
            onChange={(e) => setCurrentPerson(p => ({ ...p, designation: e.target.value }))}
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
          />
          <input
            placeholder="Phone Number"
            value={currentPerson.phoneNumber}
            onChange={(e) => setCurrentPerson(p => ({ ...p, phoneNumber: e.target.value }))}
            style={{ padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
          />
        </div>
        <button
          onClick={addPerson}
          style={{ padding: '0.5rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
        >
          + Add Person
        </button>
        {errors.personName && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>{errors.personName}</p>}
        {errors.peopleMet && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>{errors.peopleMet}</p>}
      </div>

      {/* Issues Raised */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>⚠️ Issues Raised <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '0.8125rem' }}>(Optional)</span></h2>
        
        {issuesRaised.length > 0 && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {issuesRaised.map((issue, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <span style={{ color: '#991b1b', fontSize: '0.875rem' }}>{issue}</span>
                <button onClick={() => removeIssue(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            placeholder="Describe issue..."
            value={currentIssue}
            onChange={(e) => setCurrentIssue(e.target.value)}
            style={{ flex: 1, padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addIssue();
              }
            }}
          />
          <button
            onClick={addIssue}
            style={{ padding: '0 1.25rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
          >
            Add Issue
          </button>
        </div>
      </div>

      {/* Remarks */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>💬 Remarks</h2>
        <textarea
          placeholder="Describe the outcome of this stakeholder visit..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          style={{
            width: '100%', padding: '0.625rem 0.875rem', border: `1px solid ${errors.remarks ? '#ef4444' : '#d1d5db'}`,
            borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box',
            fontFamily: 'inherit'
          }}
        />
        {errors.remarks && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>{errors.remarks}</p>}
      </div>

      {/* Next Scheduled Date */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>📆 Next Scheduled Visit <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '0.8125rem' }}>(Optional)</span></h2>
        <input
          type="date"
          value={nextScheduledDate}
          onChange={(e) => setNextScheduledDate(e.target.value)}
          style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box' }}
        />
      </div>

      {/* Photo Upload */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>📸 Photos <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '0.8125rem' }}>(Optional)</span></h2>
        <ImageUpload
          onUpload={(images) => setUploadedImages(images)}
          existingImages={uploadedImages}
          maxImages={5}
        />
      </div>

      {/* Submit Button */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => router.push('/executive/store')}
          style={{ flex: 1, padding: '0.875rem', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: '500' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            flex: 2, padding: '0.875rem', background: submitting ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', border: 'none', borderRadius: '10px', cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '0.9375rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}
        >
          {submitting ? (
            <>
              <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              Submitting...
            </>
          ) : '📤 Submit Stakeholder Visit'}
        </button>
      </div>

      {/* Past Visits (Last 5) Styled like physical visit form */}
      <div className="exec-f-sub-past-visits-card" style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
        <h3 className="exec-f-sub-section-title" style={{ margin: '0 0 16px 0' }}>
          Last 5 Stakeholder Visits
        </h3>
        <div className="exec-f-sub-visits-list">
          {loadingPastVisits ? (
            <div className="loading-text">Loading past visits...</div>
          ) : pastVisits.length === 0 ? (
            <div className="exec-f-sub-no-visits">
              <p>No previous visits found for this stakeholder.</p>
            </div>
          ) : (
            pastVisits.slice(0, 5).map((visit) => (
              <div key={visit.id} className="exec-f-sub-visit-item">
                <div className="exec-f-sub-visit-header">
                  <div className="exec-f-sub-visit-date-status">
                    <span className="exec-f-sub-visit-date">
                      {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Date not set'}
                    </span>
                    <span
                      className="exec-f-sub-visit-status"
                      style={{
                        backgroundColor: visit.status === 'REVIEWD' ? '#dcfce7' : '#fef3c7',
                        color: visit.status === 'REVIEWD' ? '#16a34a' : '#d97706'
                      }}
                    >
                      {visit.status === 'REVIEWD' ? 'Reviewed' : 'Pending Review'}
                    </span>
                  </div>
                  <button
                    className="exec-f-sub-view-details-btn"
                    onClick={() => setSelectedVisit(visit)}
                  >
                    View Details
                  </button>
                </div>
                {/* Executive Name (Current User) */}
                <div className="exec-f-sub-visit-representative">
                  <span className="exec-f-sub-person-icon">👤</span>
                  <span>{visit.executive?.name || 'Executive'}</span>
                </div>
                {visit.remarks && (
                  <div className="exec-f-sub-visit-description">
                    {visit.remarks}
                  </div>
                )}
                {Array.isArray(visit.personMet) && visit.personMet.length > 0 && (
                  <div className="exec-f-sub-visit-description" style={{ marginTop: '8px' }}>
                    <strong>Contact Person:</strong><br />
                    {visit.personMet.map(p => `${p?.name || ''} ${p?.designation ? `(${p.designation})` : ''} - ${p?.phoneNumber || ''}`).join(', ')}
                  </div>
                )}
                {visit.adminComment && (
                  <div className="exec-f-sub-admin-note">
                    <strong>Admin:</strong> {visit.adminComment}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      <StakeholderVisitDetailsModal 
        isOpen={!!selectedVisit} 
        onClose={() => setSelectedVisit(null)} 
        visit={selectedVisit} 
        brandName={brandName || ''} 
      />
    </div>
  );
};

const StakeholderVisitFormPage: React.FC = () => (
  <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>}>
    <StakeholderVisitFormContent />
  </Suspense>
);

export default StakeholderVisitFormPage;
