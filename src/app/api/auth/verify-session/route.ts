import { NextRequest, NextResponse } from 'next/server';
import { validateAndRefreshToken, storeUserInfo } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const isRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    let fullUser = null;

    // Try reading userInfo cookie if not forcing refresh
    if (!isRefresh) {
      try {
        const userInfoCookie = request.cookies.get('userInfo')?.value;
        if (userInfoCookie) {
          const decoded = decodeURIComponent(userInfoCookie);
          fullUser = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error parsing userInfo cookie:', e);
      }
    }

    let response = NextResponse.json({
      authenticated: true,
      user: fullUser || {
        id: authResult.user.userId,
        email: authResult.user.email,
        username: authResult.user.username,
        role: authResult.user.role
      }
    });

    // If fullUser was not available or refresh was requested, fetch from database and update userInfo cookie
    if (!fullUser || isRefresh) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: authResult.user.userId },
          include: {
            executive: true,
            admin: true
          }
        });

        if (dbUser) {
          let userPayload: any = {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            role: dbUser.role,
            lastLoginAt: dbUser.lastLoginAt,
            previousLoginAt: dbUser.lastLoginAt
          };

          if (dbUser.role === 'EXECUTIVE' && dbUser.executive) {
            userPayload.executive = {
              id: dbUser.executive.id,
              name: dbUser.executive.name,
              contact_number: dbUser.executive.contact_number,
              region: dbUser.executive.region
            };
          } else if (dbUser.role === 'ADMIN' && dbUser.admin) {
            userPayload.admin = {
              id: dbUser.admin.id,
              name: dbUser.admin.name,
              contact_number: dbUser.admin.contact_number,
              region: dbUser.admin.region
            };
          }

          fullUser = userPayload;
          response = NextResponse.json({
            authenticated: true,
            user: fullUser
          });

          // Store updated user info cookie
          storeUserInfo(response, userPayload);
        }
      } catch (dbError) {
        console.error('Error fetching user profile from database:', dbError);
      }
    }

    // If tokens were refreshed by validateAndRefreshToken, copy the refreshed cookies to our response
    if (authResult.response) {
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
