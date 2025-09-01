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
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<TokenPayload | null> {
  const authResult = await validateAndRefreshToken(request);
  return authResult.isAuthenticated ? authResult.user || null : null;
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
