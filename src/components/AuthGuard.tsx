'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import '../lib/authInterceptor'; // Set up global auth interceptor

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Optional role-based access control
}

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Since we use HTTP-only cookies, we can't check them client-side
    // Just proceed with server-side authentication check
    checkAuthentication();
  }, []);
  
  // Re-check authentication when pathname changes (navigation)
  useEffect(() => {
    if (isAuthenticated !== null) {
      checkAuthentication();
    }
  }, [pathname]);
  
  // Periodic authentication check every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAuthenticated === true) {
        checkAuthentication();
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/auth/verify-session', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const userData = data.user;
        
        setIsAuthenticated(true);
        setUser(userData);
        
        // Check role-based authorization
        const authorized = checkRoleAuthorization(userData.role, pathname);
        setIsAuthorized(authorized);
        
        if (!authorized) {
          // If user is trying to access a role they don't have, log them out
          await logoutUser();
        }
      } else {
        setIsAuthenticated(false);
        router.replace('/');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
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
      setIsAuthenticated(false);
      setIsAuthorized(false);
      router.replace('/');
    }
  };
  
  const checkRoleAuthorization = (userRole: string, currentPath: string): boolean => {
    // If specific roles are defined for this guard, check against them
    if (allowedRoles && allowedRoles.length > 0) {
      return allowedRoles.includes(userRole);
    }
    
    // Default path-based role checking
    if (currentPath.startsWith('/admin')) {
      return userRole === 'ADMIN';
    }
    
    if (currentPath.startsWith('/executive')) {
      return userRole === 'EXECUTIVE';
    }
    
    // Default to true for other paths
    return true;
  };

  // Don't show loading if we're redirecting
  if (isAuthenticated === false || isAuthorized === false) {
    return null;
  }

  // Show minimal loading state
  if (isAuthenticated === null || isAuthorized === null) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#64748b'
      }}>
        Verifying access...
      </div>
    );
  }

  // User is authenticated and authorized, render the protected content
  return <>{children}</>;
}
