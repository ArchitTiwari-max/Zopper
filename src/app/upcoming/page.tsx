'use client';

import { ArrowLeft, Clock } from 'lucide-react';

export default function UpcomingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#0f172a'
    }}>
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '40px 32px',
        maxWidth: '440px',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          backgroundColor: '#ecfdf5',
          color: '#059669',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto'
        }}>
          <Clock size={28} />
        </div>

        <h1 style={{
          fontSize: '22px',
          fontWeight: '700',
          margin: '0 0 12px 0',
          color: '#0f172a'
        }}>
          Work Management Portal
        </h1>

        <div style={{
          display: 'inline-block',
          backgroundColor: '#eff6ff',
          color: '#2563eb',
          fontSize: '12px',
          fontWeight: '600',
          padding: '4px 12px',
          borderRadius: '99px',
          marginBottom: '16px'
        }}>
          🚀 Upcoming Feature
        </div>

        <p style={{
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#64748b',
          margin: '0 0 28px 0'
        }}>
          This agile workspace for task tracking, to-do lists, and team execution is currently under development and will be available soon.
        </p>

        <a 
          href="/" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            width: '100%',
            boxSizing: 'border-box',
            transition: 'background-color 0.2s'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Portal Selection</span>
        </a>
      </div>
    </div>
  );
}
