import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    const ssoCookie = request.cookies.get('sso_session')?.value;
    if (ssoCookie) {
      try {
        const decoded: any = verifyToken(ssoCookie);
        if (decoded && Array.isArray(decoded.sessions) && decoded.sessions.length > 0) {
          return NextResponse.json({
            activeUserId: decoded.activeUserId || decoded.userId,
            accounts: decoded.sessions
          });
        }
        if (decoded && decoded.userId) {
          return NextResponse.json({
            activeUserId: decoded.userId,
            accounts: [{
              userId: decoded.userId,
              email: decoded.email,
              username: decoded.username,
              role: decoded.roles && decoded.roles[0] ? decoded.roles[0] : 'ADMIN',
              roles: decoded.roles || ['ADMIN']
            }]
          });
        }
      } catch (err) {
        console.error('Invalid sso_session token:', err);
      }
    }

    return NextResponse.json({ activeUserId: null, accounts: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
