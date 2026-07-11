import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/* ==============================================================================
 * SECTION 1: GLOBAL SSO & IDENTITY PROVIDER (IdP) UTILITIES & ROUTE HANDLING
 * ==============================================================================
 * This section manages the Global SSO Identity ecosystem bridge and public auth
 * redirects (e.g. directing unauthenticated consumer apps to OAuth Authorization).
 * ============================================================================== */

function getPublicOrigin(request: NextRequest) {
  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const forwardedHost = rawHost.includes('0.0.0.0') ? (request.headers.get('x-forwarded-host') || '') : rawHost;
  const isLocal = forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1');
  return forwardedHost && !forwardedHost.includes('0.0.0.0') ? `${isLocal ? 'http' : 'https'}://${forwardedHost}` : request.nextUrl.origin;
}

/**
 * GLOBAL SSO BRIDGE:
 * Redirects unauthenticated consumer app users to the Global SSO IdP Authorization Server
 * (/api/oauth/authorize) to initiate OAuth 2.0 Authorization Code flow.
 */
function getLoginRedirectUrl(request: NextRequest, errorParam?: string) {
  const { pathname } = request.nextUrl;
  const origin = getPublicOrigin(request);

  const authorizeUrl = new URL('/api/oauth/authorize', origin);
  authorizeUrl.searchParams.set('client_id', process.env.SALESDOST_CLIENT_ID || '');
  authorizeUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback/salesdost`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('state', `salesdost_self_sso:${pathname}${request.nextUrl.search}`);
  if (errorParam) authorizeUrl.searchParams.set('error', errorParam);
  return authorizeUrl;
}


/* ==============================================================================
 * SECTION 2: CONSUMER APPLICATION (SALES PLATFORM) TOKEN & SESSION HELPERS
 * ==============================================================================
 * This section verifies consumer application tokens (accessToken / refreshToken)
 * issued via OAuth Token Exchange and applies token rotations.
 * ============================================================================== */

// Helper: Attach refreshed access/refresh tokens and userInfo to response cookies
async function applyRefreshedTokens(request: NextRequest, response: NextResponse, verifyData: any) {
  console.log('[MIDDLEWARE AUTH] 🍪 Updating browser cookies with new accessToken & refreshToken.');
  const { getTokenExpiry } = await import('@/lib/jwt');
  const { storeUserInfo } = await import('@/lib/auth');

  const accessTokenExpiry = getTokenExpiry(process.env.JWT_ACCESS_EXPIRY || '15m');
  const refreshTokenExpiry = getTokenExpiry(process.env.JWT_REFRESH_EXPIRY || '7d');

  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const isLocal = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');

  response.cookies.set('accessToken', verifyData.access_token, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'lax',
    expires: accessTokenExpiry,
    path: '/'
  });

  response.cookies.set('refreshToken', verifyData.refresh_token, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'lax',
    expires: refreshTokenExpiry,
    path: '/'
  });

  storeUserInfo(response, verifyData.user);
}


async function verifySession(request: NextRequest, internalBaseUrl: string) {
  const accessToken = request.cookies.get('accessToken')?.value || '';
  const refreshToken = request.cookies.get('refreshToken')?.value || '';

  console.log('[MIDDLEWARE AUTH] 🔍 Verifying OAuth tokens with IdP (/api/oauth/verify)...');
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
  const data = await res.json();
  if (data?.tokensRefreshed) {
    console.log('[MIDDLEWARE AUTH] 🔄 Tokens rotated/refreshed successfully via API.');
  } else if (data?.authenticated) {
    console.log('[MIDDLEWARE AUTH] ✔ OAuth tokens verified successfully with IdP.');
  }
  return data;
}


/* ==============================================================================
 * MAIN MIDDLEWARE EXECUTION
 * ============================================================================== */

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
  const hasSsoSession = cookieHeader.includes('sso_session');

  const internalBaseUrl = `http://127.0.0.1:${process.env.PORT || '3000'}`;

  /* --------------------------------------------------------------------------
   * PART A: GLOBAL SSO / PUBLIC AUTH ROUTE LOGIC (/login)
   * If an already authenticated user visits /login directly, redirect them to Root (/)
   * unless they explicitly request prompt=add_account or prompt=login.
   * -------------------------------------------------------------------------- */
  const loginPrompt = request.nextUrl.searchParams.get('prompt');
  if (pathname === '/login' && hasAuthCookies && hasSsoSession && loginPrompt !== 'add_account' && loginPrompt !== 'login') {
    try {
      const verifyData = await verifySession(request, internalBaseUrl);
      if (verifyData?.authenticated && verifyData?.user) {
        const targetPath = request.nextUrl.searchParams.get('redirect')
          ? decodeURIComponent(request.nextUrl.searchParams.get('redirect')!)
          : '/';

        const origin = getPublicOrigin(request);
        const cleanTargetPath = targetPath.replace(/http[s]?:\/\/0\.0\.0\.0(:\d+)?/gi, origin);
        const response = NextResponse.redirect(new URL(cleanTargetPath, origin));
        if (verifyData.tokensRefreshed) {
          await applyRefreshedTokens(request, response, verifyData);
        }
        return response;
      }
    } catch (err) {
      console.error('[MIDDLEWARE] Public auth route redirect error:', err);
    }
  }

  /* --------------------------------------------------------------------------
   * PART B: CONSUMER APPLICATION (SALES PLATFORM) ROUTE PROTECTION & RBAC
   * Protects /admin, /executive, /api/admin, /api/executive endpoints.
   * Requires valid OAuth tokens and verifies permission-based access.
   * -------------------------------------------------------------------------- */
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

      // Permission-based RBAC Authorization check
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
        return NextResponse.redirect(new URL(`${safeDashboard}?error=access_denied`, getPublicOrigin(request)));
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(user));

      const response = NextResponse.next({
        request: { headers: requestHeaders }
      });

      if (verifyData.tokensRefreshed) {
        await applyRefreshedTokens(request, response, verifyData);
      }

      const duration = Date.now() - start;
      console.log(`[MIDDLEWARE] [${dateTime}] Completed ${request.method} ${pathname} (${duration}ms)`);
      return response;

    } catch (error) {
      console.error('[MIDDLEWARE] Error calling verify API:', error);
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }
      return NextResponse.redirect(new URL('/?error=session_expired', getPublicOrigin(request)));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
