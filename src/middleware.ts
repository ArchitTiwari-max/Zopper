import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const dateTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  const { pathname } = request.nextUrl;
  
  // Log incoming request
  console.log(`[MIDDLEWARE] [${dateTime}] ${request.method} ${pathname}`);
  
  // Ignore static files and public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // e.g. favicon.ico, manifest.json, images
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const hasAuthCookies = cookieHeader.includes('accessToken') || cookieHeader.includes('refreshToken') || cookieHeader.includes('userInfo');

  // In production/Docker environments, fetch locally to avoid DNS / public loopback network issues
  const internalBaseUrl = process.env.NODE_ENV === 'production'
    ? `http://127.0.0.1:${process.env.PORT || '3000'}`
    : request.url;

  // Handle root login page redirect if already authenticated
  if (pathname === '/') {
    if (hasAuthCookies) {
      try {
        const verifyRes = await fetch(new URL('/api/auth/verify-session', internalBaseUrl), {
          method: 'GET',
          headers: {
            cookie: cookieHeader
          }
        });

        if (verifyRes.status === 200) {
          const data = await verifyRes.json();
          if (data && data.authenticated && data.user) {
            const redirectUrl = data.user.role === 'ADMIN' ? '/admin/dashboard' : '/executive/dashboard';
            console.log(`[MIDDLEWARE] Authenticated user on root, redirecting to ${redirectUrl}`);
            return NextResponse.redirect(new URL(redirectUrl, request.url));
          }
        }
      } catch (e) {
        console.error('[MIDDLEWARE] Error verifying session on root:', e);
      }
    }
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/executive') || 
    pathname.startsWith('/api/admin') || 
    pathname.startsWith('/api/executive');

  if (isProtectedRoute) {
    // If no auth cookies exist at all, reject immediately
    if (!hasAuthCookies) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    try {
      // Verify session via backend auth verification endpoint
      const verifyRes = await fetch(new URL('/api/auth/verify-session', internalBaseUrl), {
        method: 'GET',
        headers: {
          cookie: cookieHeader
        }
      });

      if (verifyRes.status !== 200) {
        console.log(`[MIDDLEWARE] Auth verification failed (${verifyRes.status}) for ${pathname}`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      const data = await verifyRes.json();
      const user = data.user;

      if (user) {
        user.userId = user.userId || user.id;
        user.id = user.id || user.userId;
      }

      if (!user || !user.role) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Role-based authorization check
      if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && user.role !== 'ADMIN') {
        console.log(`[MIDDLEWARE] Role mismatch: User role ${user.role} attempted to access ${pathname}`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      if ((pathname.startsWith('/executive') || pathname.startsWith('/api/executive')) && user.role !== 'EXECUTIVE') {
        console.log(`[MIDDLEWARE] Role mismatch: User role ${user.role} attempted to access ${pathname}`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Inject custom header x-user-data with serialized user object
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(user));

      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Forward any refreshed authentication cookies from verify-session to the client
      const setCookieHeaders = verifyRes.headers.getSetCookie();
      if (setCookieHeaders && setCookieHeaders.length > 0) {
        setCookieHeaders.forEach(cookieStr => {
          response.headers.append('Set-Cookie', cookieStr);
        });
      }

      const duration = Date.now() - start;
      console.log(`[MIDDLEWARE] [${dateTime}] Completed ${request.method} ${pathname} (${duration}ms)`);
      return response;

    } catch (error) {
      console.error('[MIDDLEWARE] Error calling verify-session:', error);
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
