'use client';

import { useState, useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import './landing.css';

function LandingContent() {
  const [authStatus, setAuthStatus] = useState<{
    isChecked: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;
  }>({
    isChecked: true,
    isAuthenticated: false,
    isAdmin: false,
  });

  const handlePlatformSelect = (platform: 'sales' | 'work') => {
    if (platform === 'work') {
      window.location.href = '/work';
      return;
    }
    const origin = window.location.origin;
    window.location.href = `/api/oauth/authorize?client_id=sd_2e788dcd252d9297942790cd&redirect_uri=${encodeURIComponent(origin + '/api/auth/callback/salesdost')}&response_type=code&state=salesdost_self_sso:%2F`;
  };

  return (
    <div className="landing-body">
      {/* Background blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <div className="landing-container">
        {/* Header Branding matching Sign In & Dashboard */}
        <header className="landing-header">
          <div className="logo">
            <div className="logo-icon">S</div>
            <div className="logo-text-container">
              <span className="logo-text">SalesDost</span>
              <span className="logo-tagline">Safalta ka Sathi</span>
            </div>
          </div>
        </header>

        <h1 className="hero-title">
          SalesDost <span className="gradient-multi">Ecosystem</span>
        </h1>
        <p className="hero-subtitle">
          Select Your Portal
        </p>

        {/* Loading Indicator while session checks */}
        {!authStatus.isChecked && (
          <div className="loading-indicator">
            <Loader2 className="animate-spin" style={{ color: '#2563eb' }} size={18} />
            <span>Verifying active session...</span>
          </div>
        )}

        {/* Platform Grid */}
        <main className="platform-grid">
          {/* Simple Sales Platform Div */}
          <div
            className="simple-portal-div div-sales"
            onClick={() => handlePlatformSelect('sales')}
          >
            <h2 className="simple-portal-title">Sales Platform</h2>
            <p className="simple-portal-desc">
              Track sales data, monitor target achievements, and review important field performance metrics.
            </p>
          </div>

          {/* Simple Work Management Div */}
          <div
            className="simple-portal-div div-work"
            onClick={() => handlePlatformSelect('work')}
          >
            <h2 className="simple-portal-title">Work Management</h2>
            <p className="simple-portal-desc">
              Manage daily to-do lists, assign team tasks, and track project workflows &amp; issue resolution seamlessly.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="landing-body">
        <div className="landing-container">
          <header className="landing-header">
            <div className="logo">
              <div className="logo-icon">S</div>
              <div className="logo-text-container">
                <span className="logo-text">SalesDost</span>
                <span className="logo-tagline">Safalta ka Sathi</span>
              </div>
            </div>
          </header>
          <div className="loading-indicator">
            <Loader2 className="animate-spin" style={{ color: '#2563eb' }} size={18} />
            <span>Loading portal...</span>
          </div>
        </div>
      </div>
    }>
      <LandingContent />
    </Suspense>
  );
}
