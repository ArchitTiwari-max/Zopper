'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface StakeholderDesignation {
  id: string;
  designation: string;
  brands: string[];
}

interface BrandItem {
  id: string;
  brandName: string;
}

export default function StakeholdersPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderDesignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);

  const toggleBrand = (brandId: string) => {
    setExpandedBrandId(prev => prev === brandId ? null : brandId);
  };

  useEffect(() => {
    const fetchStakeholdersAndBrands = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/executive/stakeholders', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setStakeholders(data.stakeholders || []);
          setBrands(data.brands || []);
        }
      } catch (e) {
        console.error('Failed to fetch data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStakeholdersAndBrands();
  }, []);

  const filteredBrands = brands.filter((b) =>
    !search || b.brandName.toLowerCase().includes(search.toLowerCase())
  );

  const navigateToForm = (brandId: string, brandName: string, designation: string) => {
    const params = new URLSearchParams({
      brandId,
      brandName,
      designation,
    });
    router.push(`/executive/stakeholder-visit-form?${params.toString()}`);
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 120px)',
        background: '#f8fafc',
        padding: '0 0 100px',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          padding: '1.5rem 1.25rem 2.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: '-30px', left: '40%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: '700', color: 'white', position: 'relative' }}>
          🤝 Brand Stakeholders
        </h1>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', position: 'relative' }}>
          Select a brand and designation to submit a visit
        </p>
      </div>

      {/* Main Content */}
      <div style={{ margin: '-1.5rem 1.25rem 0', position: 'relative', zIndex: 10 }}>
        {/* Search */}
        <div
          style={{
            background: 'white',
            padding: '0.75rem',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Search brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '0.9375rem',
              color: '#334155',
            }}
          />
        </div>

        {/* Brands List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="loading-spinner-large" style={{ margin: '0 auto 1rem', width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b', margin: 0 }}>Loading brands...</p>
          </div>
        ) : filteredBrands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b', fontSize: '1.125rem' }}>No brands found</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Try adjusting your search</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredBrands.map((brand) => {
              // Find designations that apply to this brand
              const applicableDesignations = stakeholders.filter(s => 
                s.brands.includes(brand.brandName) || s.brands.includes(brand.id)
              );

              if (applicableDesignations.length === 0) return null;

              const isExpanded = expandedBrandId === brand.id;

              return (
                <div
                  key={brand.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  <div 
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isExpanded ? '1rem' : '0', cursor: 'pointer' }}
                    onClick={() => toggleBrand(brand.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: 'white', fontWeight: 'bold' }}>
                        {brand.brandName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', color: '#1e293b', fontWeight: '600' }}>
                          {brand.brandName}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                          {applicableDesignations.length} available designations
                        </p>
                      </div>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '1.25rem', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                      ▼
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {applicableDesignations.map(dsg => (
                      <button
                        key={dsg.id}
                        onClick={() => navigateToForm(brand.id, brand.brandName, dsg.designation)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.875rem 1rem',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          color: '#334155',
                          fontSize: '0.9375rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      >
                        <span>{dsg.designation}</span>
                        <span style={{ color: '#6366f1' }}>→</span>
                      </button>
                    ))}
                    {applicableDesignations.length === 0 && (
                      <div style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                        No stakeholder designations available for this brand
                      </div>
                    )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
