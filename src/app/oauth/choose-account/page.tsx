'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UserCheck, UserPlus, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import '../oauth-sessions.css';

interface SavedAccount {
  userId: string;
  email: string;
  username: string;
  name?: string;
  role: string;
  roles?: string[];
  lastLoginAt?: string;
}

function ChooseAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/auth/sessions');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.accounts)) {
            const seen = new Set<string>();
            const unique = data.accounts.filter((a: any) => {
              const k = a.userId || a.email;
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            }).slice(0, 3);
            setAccounts(unique);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to fetch account sessions:', err);
      }
      setAccounts([]);
    }
    fetchSessions();
  }, []);

  const handleSelectAccount = async (account: SavedAccount) => {
    setLoadingId(account.userId);
    setError(null);
    try {
      const res = await fetch('/api/auth/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: account.userId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to switch account');
      }

      let finalRedirect = redirectUrl;
      try {
        const u = new URL(redirectUrl, window.location.origin);
        u.searchParams.delete('prompt');
        u.searchParams.set('account_selected', 'true');
        finalRedirect = u.toString();
      } catch (e) {}

      window.location.href = finalRedirect;
    } catch (err: any) {
      setError(err.message || 'Error switching account');
      setLoadingId(null);
    }
  };

  const handleRemoveAccount = async (e: React.MouseEvent, account: SavedAccount) => {
    e.stopPropagation();
    setRemovingId(account.userId);
    try {
      const res = await fetch('/api/auth/remove-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: account.userId })
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.userId !== account.userId));
      }
    } catch (err) {
      console.error('Failed to remove account:', err);
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddAccount = () => {
    if (accounts.length >= 3) {
      setError('Maximum limit of 3 accounts reached on this device. Please remove an account first.');
      return;
    }
    const loginUrl = new URL('/login', window.location.origin);
    loginUrl.searchParams.set('redirect', redirectUrl);
    loginUrl.searchParams.set('prompt', 'add_account');
    window.location.href = loginUrl.toString();
  };

  return (
    <div className="oauth-page-container">
      <div className="oauth-card">
        <div className="oauth-header">
          <div className="oauth-logo-badge">
            <UserCheck size={30} />
          </div>
          <h1>Choose an account</h1>
          <p>to continue to <span>Salesdost SSO</span></p>
        </div>

        {error && (
          <div className="oauth-alert oauth-alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="oauth-account-list">
          {accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '14px' }}>
              No saved accounts found on this device.
            </div>
          ) : (
            accounts.map((acc, index) => {
              const displayRole = acc.role || (Array.isArray(acc.roles) ? acc.roles[0] : 'EXECUTIVE');
              const isAdmin = displayRole === 'ADMIN';
              const isLoadingThis = loadingId === acc.userId;
              return (
                <div
                  key={acc.userId || index}
                  onClick={() => !isLoadingThis && handleSelectAccount(acc)}
                  className={`oauth-account-item ${index === 0 ? 'active-session' : ''}`}
                >
                  <div className="oauth-account-left">
                    <div className={`oauth-avatar ${isAdmin ? 'avatar-admin' : 'avatar-exec'}`}>
                      {(acc.name || acc.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="oauth-account-info">
                      <div className="oauth-account-name-row">
                        <span className="oauth-account-name">{acc.name || acc.username}</span>
                        <span className={`oauth-role-badge ${isAdmin ? 'badge-admin' : 'badge-exec'}`}>
                          {displayRole}
                        </span>
                      </div>
                      <span className="oauth-account-email">{acc.email}</span>
                    </div>
                  </div>

                  <div className="oauth-account-actions">
                    <button
                      type="button"
                      onClick={(e) => handleRemoveAccount(e, acc)}
                      disabled={removingId === acc.userId}
                      title="Remove account from device"
                      className="oauth-btn-trash"
                    >
                      <Trash2 size={16} />
                    </button>
                    {isLoadingThis ? (
                      <Loader2 size={18} className="animate-spin" style={{ color: '#818cf8' }} />
                    ) : (
                      <ArrowRight size={18} style={{ color: '#94a3b8' }} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={handleAddAccount}
          className="oauth-add-btn"
        >
          <UserPlus size={18} style={{ color: '#818cf8' }} />
          <span>Use another account</span>
        </button>
      </div>
    </div>
  );
}

export default function ChooseAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="oauth-page-container">
          <Loader2 size={32} className="animate-spin" style={{ color: '#818cf8' }} />
        </div>
      }
    >
      <ChooseAccountContent />
    </Suspense>
  );
}
