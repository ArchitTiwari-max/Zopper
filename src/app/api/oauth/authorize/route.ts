import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAndRefreshToken } from '@/lib/auth';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  const state = searchParams.get('state');
  const scope = searchParams.get('scope');

  // Basic validation of client_id and redirect_uri
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing client_id or redirect_uri parameters' },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch client from DB
    const client = await prisma.client.findUnique({
      where: { clientId },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Invalid client_id. Application not registered.' },
        { status: 400 }
      );
    }

    // 2. Validate redirect_uri matches registered URIs
    if (!client.redirectUris.includes(redirectUri)) {
      return NextResponse.json(
        { error: 'Invalid redirect_uri. The URI does not match registered callbacks.' },
        { status: 400 }
      );
    }

    // 3. Validate response_type
    if (responseType !== 'code') {
      const errorUrl = new URL(redirectUri);
      errorUrl.searchParams.set('error', 'unsupported_response_type');
      if (state) errorUrl.searchParams.set('state', state);
      return NextResponse.redirect(errorUrl.toString());
    }

    // 4. Verify user session using existing cookies
    const authResult = await validateAndRefreshToken(request);

    if (!authResult.isAuthenticated || !authResult.user) {
      // User is not authenticated, redirect them to login page
      // After successful login, they will be redirected back to this exact authorization page
      const currentUrl = request.url;
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', currentUrl);
      
      return NextResponse.redirect(loginUrl.toString());
    }

    // 5. Generate secure random authorization code
    const code = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // 6. Save authorization code to database
    await prisma.authorizationCode.create({
      data: {
        code,
        clientId,
        userId: authResult.user.userId,
        redirectUri,
        scope,
        expiresAt,
      },
    });

    // 7. Redirect back to client app with the code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    const response = NextResponse.redirect(redirectUrl.toString());

    // If session verification refreshed the access token cookies, copy them to the redirect response
    if (authResult.response) {
      authResult.response.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as any,
          expires: cookie.expires,
          path: cookie.path,
        });
      });
    }

    return response;

  } catch (error) {
    console.error('OAuth Authorization Error:', error);
    
    // Redirect with internal server error if redirectUri is validated
    try {
      const errorUrl = new URL(redirectUri);
      errorUrl.searchParams.set('error', 'server_error');
      if (state) errorUrl.searchParams.set('state', state);
      return NextResponse.redirect(errorUrl.toString());
    } catch {
      return NextResponse.json(
        { error: 'Internal server error during authorization' },
        { status: 500 }
      );
    }
  }
}
