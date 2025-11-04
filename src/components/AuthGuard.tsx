'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUserFromCookie, isAuthenticated, isAuthorizedForPath } from '../lib/cookieUtils';
import '../lib/authInterceptor'; // Set up global auth interceptor

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Optional role-based access control
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    isAuthorized: boolean;
    isLoading: boolean;
  }>({ isAuthenticated: false, isAuthorized: false, isLoading: true });

  // Check authentication on mount and pathname changes
  useEffect(() => {
    checkCookieAuth();
  }, [pathname]);
  

  const checkCookieAuth = () => {
    try {
      const authenticated = isAuthenticated();
      
      if (!authenticated) {
        setAuthState({
          isAuthenticated: false,
          isAuthorized: false,
          isLoading: false
        });
        router.replace('/');
        return;
      }

      const authorized = isAuthorizedForPath(pathname, allowedRoles);
      
      if (!authorized) {
        setAuthState({
          isAuthenticated: true,
          isAuthorized: false,
          isLoading: false
        });
        // Redirect unauthorized users
        logoutUser();
        return;
      }

      setAuthState({
        isAuthenticated: true,
        isAuthorized: true,
        isLoading: false
      });
    } catch (error) {
      console.error('Cookie auth check failed:', error);
      setAuthState({
        isAuthenticated: false,
        isAuthorized: false,
        isLoading: false
      });
      router.replace('/');
    }
  };

  
  const logoutUser = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setAuthState({
        isAuthenticated: false,
        isAuthorized: false,
        isLoading: false
      });
      router.replace('/');
    }
  };

  // Don't show loading if we're redirecting
  if (!authState.isAuthenticated || !authState.isAuthorized) {
    return null;
  }

  // Show minimal loading state (should be very brief with cookie auth)
  if (authState.isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#64748b'
      }}>
        Loading...
      </div>
    );
  }

  // User is authenticated and authorized, render the protected content
  return <>{children}</>;
}
