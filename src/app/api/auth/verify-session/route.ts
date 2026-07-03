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
          const parsed = JSON.parse(decoded);
          // Only use the cached user info if it has the permissions array
          if (parsed && Array.isArray(parsed.permissions)) {
            fullUser = parsed;
          }
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
        role: authResult.user.role,
        permissions: []
      }
    });

    // If fullUser was not available or refresh was requested, fetch from database and update userInfo cookie
    if (!fullUser || isRefresh) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: authResult.user.userId },
          include: {
            employee: true
          }
        });

        if (dbUser) {
          const userRoles = dbUser.roles && dbUser.roles.length > 0 ? dbUser.roles : ['EXECUTIVE'];
          
          const allUserRoles = await prisma.userRole.findMany({
            where: { name: { in: userRoles } }
          });
          const combinedPermissions = Array.from(new Set([
            ...allUserRoles.flatMap(r => r.permissions),
            ...(dbUser.permissions || [])
          ]));

          let userPayload: any = {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            role: userRoles[0],
            roles: userRoles,
            permissions: combinedPermissions,
            userRole: null,
            lastLoginAt: dbUser.lastLoginAt,
            previousLoginAt: dbUser.lastLoginAt
          };

          if (dbUser.employee) {
            userPayload.employee = {
              id: dbUser.employee.id,
              name: dbUser.employee.name,
              contact_number: dbUser.employee.contact_number,
              region: dbUser.employee.region,
              designation: dbUser.employee.designation,
              department: dbUser.employee.department
            };

            // Add legacy role-specific information for backward compatibility on client side
            if (userRoles.includes('EXECUTIVE')) {
              userPayload.executive = {
                id: dbUser.employee.id,
                name: dbUser.employee.name,
                contact_number: dbUser.employee.contact_number,
                region: dbUser.employee.region
              };
            }
            if (userRoles.includes('ADMIN')) {
              userPayload.admin = {
                id: dbUser.employee.id,
                name: dbUser.employee.name,
                contact_number: dbUser.employee.contact_number,
                region: dbUser.employee.region
              };
            }
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
