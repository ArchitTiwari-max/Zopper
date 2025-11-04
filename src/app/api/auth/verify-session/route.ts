import { NextRequest, NextResponse } from 'next/server';
import { validateAndRefreshToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Use the full auth validation that can handle refresh tokens
    const authResult = await validateAndRefreshToken(request);

    if (!authResult.isAuthenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Create successful response
    const response = NextResponse.json({
      authenticated: true,
      user: {
        id: authResult.user.userId,
        email: authResult.user.email,
        username: authResult.user.username,
        role: authResult.user.role
      }
    });

    // If tokens were refreshed, the authResult.response contains updated cookies
    if (authResult.response) {
      // Copy the refreshed cookies to our response
      const refreshedCookies = authResult.response.cookies.getAll();
      refreshedCookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: false, // Set to false for development (localhost)
          sameSite: 'lax',
          expires: cookie.expires ? new Date(cookie.expires) : undefined,
          path: cookie.path || '/'
        });
      });
    }

    return response;

  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 401 }
    );
  }
}
