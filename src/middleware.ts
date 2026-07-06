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
        return NextResponse.redirect(new URL('/?error=session_expired', request.url));
      }

      const data = await verifyRes.json();
      const user = data.user;

      if (user) {
        user.userId = user.userId || user.id;
        user.id = user.id || user.userId;
      }

      if (!user || (!user.role && (!user.roles || user.roles.length === 0))) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/?error=session_expired', request.url));
      }

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
        console.log(`[MIDDLEWARE] Permission mismatch: User missing required permission '${requiredPermission}' for ${pathname}`);
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const userRoles = user.roles || [];
        const safeDashboard = userRoles.includes('ADMIN') ? '/admin/dashboard' : '/executive/dashboard';
        return NextResponse.redirect(new URL(`${safeDashboard}?error=access_denied`, request.url));
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
