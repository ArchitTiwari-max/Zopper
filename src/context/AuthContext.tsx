'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setupAuthInterceptor } from '@/lib/authInterceptor';

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
  refreshAuth: () => Promise<UserInfo | null>;
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
  // Initialize state directly from initialUser injected via Server Component / headers (Phase 3)
  const [user, setUser] = useState<UserInfo | null>(initialUser || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialUser);

  // Function to fetch latest auth state on-demand (Phase 4)
  // This only use when there is any update in session like onboarding page user detail change form submit, not for initial loading
  const refreshAuth = useCallback(async (): Promise<UserInfo | null> => {
    try {
      const response = await fetch('/api/auth/verify-session?refresh=true', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.user) {
          setUser(data.user);
          setIsLoading(false);
          return data.user;
        }
      }
      
      // If verification fails and we didn't have a valid initialUser
      if (!initialUser) {
        setUser(null);
      }
      setIsLoading(false);
      return null;
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setIsLoading(false);
      return null;
    }
  }, [initialUser]);

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
    setupAuthInterceptor(refreshAuth, logout);
  }, [refreshAuth, logout]);

  // If initialUser was NOT provided (e.g. client-only navigation fallback), verify once
  useEffect(() => {
    if (!initialUser && isLoading) {
      refreshAuth();
    } else if (initialUser) {
      // Ensure loading is false when initialUser is present
      setIsLoading(false);
    }
  }, [initialUser, isLoading, refreshAuth]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    refreshAuth,
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
