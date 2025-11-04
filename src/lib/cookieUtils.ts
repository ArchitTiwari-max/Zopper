// Cookie utility functions for client-side authentication
export interface UserInfo {
  id: string;
  email: string;
  username: string;
  role: string;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue || null;
  }
  
  return null;
}

/**
 * Parse userInfo cookie and return user data
 */
export function getUserFromCookie(): UserInfo | null {
  try {
    const userInfoCookie = getCookie('userInfo');
    
    if (!userInfoCookie) {
      return null;
    }

    // Decode the cookie value (it might be URL encoded)
    const decodedCookie = decodeURIComponent(userInfoCookie);
    
    // Parse the JSON
    const userData = JSON.parse(decodedCookie);
    
    // Validate that we have the required fields
    if (userData && userData.id && userData.email && userData.username && userData.role) {
      return {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        role: userData.role
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing userInfo cookie:', error);
    return null;
  }
}

/**
 * Check if user is authenticated based on cookie
 */
export function isAuthenticated(): boolean {
  return getUserFromCookie() !== null;
}

/**
 * Check if user has required role
 */
export function hasRole(requiredRoles: string[]): boolean {
  const user = getUserFromCookie();
  
  if (!user) {
    return false;
  }
  
  return requiredRoles.includes(user.role);
}

/**
 * Check role authorization based on path
 */
export function isAuthorizedForPath(path: string, allowedRoles?: string[]): boolean {
  const user = getUserFromCookie();
  
  if (!user) {
    return false;
  }
  
  // If specific roles are defined, check against them
  if (allowedRoles && allowedRoles.length > 0) {
    return allowedRoles.includes(user.role);
  }
  
  // Default path-based role checking
  if (path.startsWith('/admin')) {
    return user.role === 'ADMIN';
  }
  
  if (path.startsWith('/executive')) {
    return user.role === 'EXECUTIVE';
  }
  
  // Default to true for other paths
  return true;
}