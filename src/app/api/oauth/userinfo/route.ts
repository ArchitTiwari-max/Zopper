import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export const runtime = 'nodejs';

// 1. CORS Preflight OPTIONS Request Handler
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// 2. GET UserInfo Handler
export async function GET(request: NextRequest) {
  // Common helper for CORS responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing or invalid Authorization header' },
      { status: 401, headers: corsHeaders }
    );
  }

  const token = authHeader.substring(7);

  try {
    // Verify Access Token
    const payload = verifyToken(token);

    if (!payload.userId) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token payload missing user identifier' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Fetch user details from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        employee: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'User not found' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'User account deactivated' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Get permissions from user roles
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : ['EXECUTIVE'];
    const allUserRoles = await prisma.userRole.findMany({
      where: { name: { in: userRoles } },
    });
    const combinedPermissions = Array.from(
      new Set([
        ...allUserRoles.flatMap((r) => r.permissions),
        ...(user.permissions || []),
      ])
    );

    // Build the user profile response payload
    const userProfile = {
      id: user.id,
      email: user.email,
      username: user.username,
      roles: userRoles,
      permissions: combinedPermissions,
      employee: user.employee
        ? {
            id: user.employee.id,
            name: user.employee.name,
            contact_number: user.employee.contact_number,
            region: user.employee.region,
            designation: user.employee.designation,
            department: user.employee.department,
          }
        : null,
    };

    return NextResponse.json(userProfile, {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('OAuth UserInfo Endpoint Error:', error);
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Token verification failed' },
      { status: 401, headers: corsHeaders }
    );
  }
}
