import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateAccessToken, getTokenExpiry, TokenPayload } from './jwt';

export interface AuthResult {
  isAuthenticated: boolean;
  user?: TokenPayload;
  response?: NextResponse;
}

/**
 * Validates access token and refreshes it if expired using refresh token
 * Returns authentication result and optionally a response with new cookies
 */
export async function validateAndRefreshToken(request: NextRequest): Promise<AuthResult> {
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  // If no access token, try to use refresh token
  if (!accessToken) {
    if (!refreshToken) {
      return { isAuthenticated: false };
    }

    return await refreshAccessToken(refreshToken);
  }

  // Try to verify access token
  try {
    const user = verifyToken(accessToken);
    return { isAuthenticated: true, user };
  } catch (error) {
    // Access token is invalid/expired, try refresh token
    if (!refreshToken) {
      return { isAuthenticated: false };
    }

    return await refreshAccessToken(refreshToken);
  }
}

/**
 * Verifies sso_session cookie for IdP Authorization Server routes (/api/oauth/authorize)
 * Strictly requires a valid sso_session cookie without falling back to local access/refresh tokens
 */
export async function verifySsoSession(request: NextRequest): Promise<AuthResult> {
  const ssoSession = request.cookies.get('sso_session')?.value;
  if (ssoSession) {
    try {
      const user = verifyToken(ssoSession);
      return { isAuthenticated: true, user };
    } catch (error) {
      // sso_session invalid/expired
    }
  }
  return { isAuthenticated: false };
}

/**
 * Creates new access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  try {
    // Verify refresh token
    const user = verifyToken(refreshToken);

    // Generate new access token
    const newAccessToken = generateAccessToken(user);
    const accessTokenExpiry = getTokenExpiry(process.env.JWT_ACCESS_EXPIRY || '15m');

    // Create response with new access token cookie
    const response = NextResponse.next();
    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: false, // Set to false for development (localhost)
      sameSite: 'lax',
      expires: accessTokenExpiry,
      path: '/'
    });

    return {
      isAuthenticated: true,
      user,
      response
    };
  } catch (error) {
    // Refresh token is also invalid
    return { isAuthenticated: false };
  }
}

/**
 * Clears authentication cookies and user info
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set('accessToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/'
  });

  response.cookies.set('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/'
  });

  // Clear user info cookie as well
  response.cookies.set('userInfo', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/'
  });

  return response;
}

/**
 * Gets authenticated user from request cookies
 * Automatically sets refreshed tokens in response cookies
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<TokenPayload | null> {
  // 1. Fast Path: If Edge Proxy Middleware already verified the user and injected x-user-data header
  const userDataHeader = request.headers.get('x-user-data');
  if (userDataHeader) {
    try {
      const user = JSON.parse(userDataHeader);
      if (user && (user.userId || user.id)) {
        return {
          userId: user.userId || user.id,
          email: user.email,
          username: user.username,
          roles: user.roles || []
        };
      }
    } catch (e) {
      console.error('Error parsing x-user-data header in getAuthenticatedUser:', e);
    }
  }

  // 2. Fallback: Validate token from cookie if header is missing
  const authResult = await validateAndRefreshToken(request);

  // If tokens were refreshed, set them directly in the response using Next.js cookies
  if (authResult.response && authResult.isAuthenticated) {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();

      const refreshedCookies = authResult.response.cookies.getAll();

      // Set refreshed cookies directly in the current API response
      refreshedCookies.forEach(cookie => {
        cookieStore.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: cookie.expires ? new Date(cookie.expires) : undefined,
          path: '/'
        });
      });
    } catch (error) {
      console.error('Failed to set refreshed cookies:', error);
    }
  }

  return authResult.isAuthenticated ? authResult.user || null : null;
}

/**
 * Clears all user-specific cache and storage data (client-side)
 * Call this function on logout to prevent data leakage between users
 */
export function clearAllCache(): void {
  console.log('🧹 Starting cache clearing process...');

  try {
    // Clear localStorage
    if (typeof Storage !== 'undefined' && localStorage) {
      const localStorageCount = localStorage.length;
      localStorage.clear();
      console.log(`✅ LocalStorage cleared (${localStorageCount} items)`);
    } else {
      console.log('⚠️ LocalStorage not available');
    }

    // Clear sessionStorage  
    if (typeof Storage !== 'undefined' && sessionStorage) {
      const sessionStorageCount = sessionStorage.length;
      sessionStorage.clear();
      console.log(`✅ SessionStorage cleared (${sessionStorageCount} items)`);
    } else {
      console.log('⚠️ SessionStorage not available');
    }

    // Clear all cookies manually (in addition to server-side clearing)
    if (typeof document !== 'undefined') {
      const cookiesBefore = document.cookie;
      console.log('🍪 Cookies before clearing:', cookiesBefore);

      document.cookie.split(';').forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name) {
          // Clear cookie for current path
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          // Clear cookie for domain
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
          console.log(`🗑️ Cleared cookie: ${name}`);
        }
      });

      const cookiesAfter = document.cookie;
      console.log('🍪 Cookies after clearing:', cookiesAfter);
    } else {
      console.log('⚠️ Document not available for cookie clearing');
    }

    // Clear Service Worker caches
    if ('caches' in window) {
      caches.keys().then(names => {
        console.log(`🗄️ Found ${names.length} cache(s) to clear:`, names);
        names.forEach(name => {
          caches.delete(name).then(success => {
            console.log(`${success ? '✅' : '❌'} Cache '${name}' deletion: ${success}`);
          });
        });
      }).catch(error => {
        console.warn('❌ Could not clear Service Worker caches:', error);
      });
    } else {
      console.log('⚠️ Service Worker caches not available');
    }

    // Clear any React/Next.js specific cached data
    if (typeof window !== 'undefined') {
      // Clear Next.js router cache
      if ((window as any).__NEXT_DATA__) {
        delete (window as any).__NEXT_DATA__;
        console.log('✅ Cleared __NEXT_DATA__');
      }
      if ((window as any).__NEXT_LOADED_PAGES__) {
        delete (window as any).__NEXT_LOADED_PAGES__;
        console.log('✅ Cleared __NEXT_LOADED_PAGES__');
      }
      // Clear any global app state
      if ((window as any).__APP_STATE__) {
        delete (window as any).__APP_STATE__;
        console.log('✅ Cleared __APP_STATE__');
      }
    }

    console.log('✅ All user cache cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing user cache:', error);
  }
}

/**
 * Stores user information in cookie as JSON string
 */
export function storeUserInfo(response: NextResponse, userPayload: any): NextResponse {
  try {
    // Store user info as JSON string in cookie
    const userInfoJson = JSON.stringify(userPayload);

    response.cookies.set('userInfo', userInfoJson, {
      httpOnly: false, // Allow client-side access for user info
      secure: false, // Set to false for development (localhost)
      sameSite: 'lax',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Error storing user info:', error);
    return response;
  }
}

/**
 * Protected route patterns that require authentication
 */
// export const PROTECTED_ROUTES = [
//   '/admin',
//   '/executive',
//   '/api/admin',
//   '/api/executive'
// ];

/**
 * Public route patterns that don't require authentication
 */
// export const PUBLIC_ROUTES = [
//   '/',
//   '/api/auth'
// ];

/**
 * Checks if a path requires authentication
 */
// export function isProtectedRoute(pathname: string): boolean {
//   return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
// }

/**
 * Checks if a path is public
 */
// export function isPublicRoute(pathname: string): boolean {
//   return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
// }
