'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setupAuthInterceptor } from '@/lib/authInterceptor';
import { usePathname } from 'next/navigation';

export interface UserInfo {
  id: string;
  email: string;
  username: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  userRole?: {
    id: string;
    name: string;
    permissions: string[];
  } | null;
  employee?: {
    id: string;
    name: string;
    contact_number?: string;
    region?: string;
    designation?: string | null;
    department?: string | null;
  } | null;
  lastLoginAt?: string;
  previousLoginAt?: string;
  executive?: {
    id: string;
    name: string;
    contact_number?: string;
    region?: string;
  };
  admin?: {
    id: string;
    name: string;
    contact_number?: string;
    region?: string;
  };
  [key: string]: any;
}

export type User = UserInfo;

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  updateUser: (newUser: Partial<UserInfo>) => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: UserInfo | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialUser }) => {
  const pathname = usePathname();
  // Initialize state directly from initialUser injected via Server Component / headers (Phase 3)
  const [user, setUser] = useState<UserInfo | null>(initialUser || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }, []);

  const updateUser = useCallback((newUser: Partial<UserInfo>) => {
    setUser(prev => prev ? { ...prev, ...newUser } : null);
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    
    // Check in userRole first (new schema)
    if (user.userRole && Array.isArray(user.userRole.permissions)) {
      if (user.userRole.permissions.includes(permission)) return true;
    }
    
    // Fallback to legacy permissions array
    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }
    
    return false;
  }, [user]);

  // On mount, set up the global API interceptor (Phase 5)
  useEffect(() => {
    setupAuthInterceptor(undefined, logout);
  }, [logout]);

  // Check URL query parameters on mount to display access denied or session expired alerts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam === 'access_denied') {
        import('@/lib/authNotifications').then(({ showAccessDeniedNotification }) => {
          showAccessDeniedNotification('Access Denied: You do not have permission to view that page.');
        });
        
        // Clean URL query parameters so it doesn't pop up again on refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
      } else if (errorParam === 'session_expired') {
        import('@/lib/authNotifications').then(({ showAccessDeniedNotification }) => {
          showAccessDeniedNotification('Session Expired: Please log in again.');
        });
        
        // Clean URL query parameters
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [pathname]);

  // If initialUser changes, update user state
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    }
  }, [initialUser]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout,
    updateUser,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
