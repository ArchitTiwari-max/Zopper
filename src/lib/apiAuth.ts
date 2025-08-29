// /src/lib/apiAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from './auth';

export async function requireAuth(request: NextRequest, allowedRoles?: string[]) {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    };
  }

  // Check roles if specified
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    };
  }

  return { user };
}

// Usage in API routes:
export async function GET(request: NextRequest) {
  const authCheck = await requireAuth(request, ['ADMIN']);
  if (authCheck.error) return authCheck.error;
  
  const user = authCheck.user;
  // Your protected logic here
}