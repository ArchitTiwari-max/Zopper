import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Helper: Attach refreshed access/refresh tokens and userInfo to response cookies
async function applyRefreshedTokens(response: NextResponse, verifyData: any) {
  console.log('[MIDDLEWARE] Saving refreshed tokens in browser cookies.');
  const { getTokenExpiry } = await import('@/lib/jwt');
  const { storeUserInfo } = await import('@/lib/auth');

  const accessTokenExpiry = getTokenExpiry(process.env.JWT_ACCESS_EXPIRY || '15m');
  const refreshTokenExpiry = getTokenExpiry(process.env.JWT_REFRESH_EXPIRY || '7d');

  response.cookies.set('accessToken', verifyData.access_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    expires: accessTokenExpiry,
    path: '/'
  });

  response.cookies.set('refreshToken', verifyData.refresh_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    expires: refreshTokenExpiry,
    path: '/'
  });

  storeUserInfo(response, verifyData.user);
}

// Helper: Generate login/SSO redirect URL based on platform
function getLoginRedirectUrl(request: NextRequest, errorParam?: string) {
  const { pathname } = request.nextUrl;
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || (request.headers.get('host')?.includes('localhost') ? 'http' : 'https');
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;

  const authorizeUrl = new URL('/api/oauth/authorize', origin);
  authorizeUrl.searchParams.set('client_id', process.env.SALESDOST_CLIENT_ID || '');
  authorizeUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback/salesdost`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('state', `salesdost_self_sso:${pathname}${request.nextUrl.search}`);
  if (errorParam) authorizeUrl.searchParams.set('error', errorParam);
  return authorizeUrl;
}

// Helper: Call backend /api/oauth/verify endpoint
async function verifySession(request: NextRequest, internalBaseUrl: string) {
  const accessToken = request.cookies.get('accessToken')?.value || '';
  const refreshToken = request.cookies.get('refreshToken')?.value || '';

  const res = await fetch(new URL('/api/oauth/verify', internalBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      client_id: process.env.SALESDOST_CLIENT_ID || '',
      client_secret: process.env.SALESDOST_CLIENT_SECRET || ''
    })
  });

  if (res.status !== 200) return null;
  return await res.json();
}

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const dateTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  const { pathname } = request.nextUrl;

  console.log(`[MIDDLEWARE] [${dateTime}] ${request.method} ${pathname}`);

  // Ignore static files and public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const hasAuthCookies = cookieHeader.includes('accessToken') || cookieHeader.includes('refreshToken') || cookieHeader.includes('userInfo');

  const internalBaseUrl = `http://127.0.0.1:${process.env.PORT || '3000'}`;

  // 1. Auto-redirect authenticated users accessing landing (/) or login (/login) to their dashboard
  if ((pathname === '/' || pathname === '/login') && hasAuthCookies) {
    try {
      const verifyData = await verifySession(request, internalBaseUrl);
      if (verifyData?.authenticated && verifyData?.user) {
        const isAdmin = (verifyData.user.roles || []).includes('ADMIN');
        const defaultPath = isAdmin ? '/admin/dashboard' : '/executive/dashboard';
        const targetPath = request.nextUrl.searchParams.get('redirect')
          ? decodeURIComponent(request.nextUrl.searchParams.get('redirect')!)
          : defaultPath;

        const response = NextResponse.redirect(new URL(targetPath, request.url));
        if (verifyData.tokensRefreshed) {
          await applyRefreshedTokens(response, verifyData);
        }
        return response;
      }
    } catch (err) {
      console.error('[MIDDLEWARE] Public auth route redirect error:', err);
    }
  }

  // 2. Protect route check
  const isProtectedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/executive') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/executive');

  if (isProtectedRoute) {
    if (!hasAuthCookies) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(getLoginRedirectUrl(request));
    }

    try {
      const verifyData = await verifySession(request, internalBaseUrl);
      const user = verifyData?.user;

      if (!user || !user.roles || user.roles.length === 0) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(getLoginRedirectUrl(request, 'session_expired'));
      }

      user.userId = user.userId || user.id;
      user.id = user.id || user.userId;

      // Permission-based authorization check
      let requiredPermission: string | null = null;
      if (pathname.startsWith('/admin/datamanagement/storewise') || pathname.startsWith('/api/admin/excel-import/storeimport') || pathname.startsWith('/api/admin/excel-export/stores')) {
        requiredPermission = 'MANAGE_STORE_IMPORT';
      } else if (pathname.startsWith('/admin/datamanagement/usermanagement') || pathname.startsWith('/api/admin/users')) {
        requiredPermission = 'MANAGE_USERS';
      } else if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        requiredPermission = 'ACCESS_ADMIN_PORTAL';
      } else if (pathname.startsWith('/executive') || pathname.startsWith('/api/executive')) {
        requiredPermission = 'ACCESS_EXECUTIVE_PORTAL';
      }

      const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];
      if (requiredPermission && !userPermissions.includes(requiredPermission)) {
        console.log(`[MIDDLEWARE] Permission mismatch: User missing '${requiredPermission}' for ${pathname}`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const safeDashboard = (user.roles || []).includes('ADMIN') ? '/admin/dashboard' : '/executive/dashboard';
        return NextResponse.redirect(new URL(`${safeDashboard}?error=access_denied`, request.url));
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(user));

      const response = NextResponse.next({
        request: { headers: requestHeaders }
      });

      if (verifyData.tokensRefreshed) {
        await applyRefreshedTokens(response, verifyData);
      }

      const duration = Date.now() - start;
      console.log(`[MIDDLEWARE] [${dateTime}] Completed ${request.method} ${pathname} (${duration}ms)`);
      return response;

    } catch (error) {
      console.error('[MIDDLEWARE] Error calling verify API:', error);
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }
      return NextResponse.redirect(new URL('/?error=session_expired', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
