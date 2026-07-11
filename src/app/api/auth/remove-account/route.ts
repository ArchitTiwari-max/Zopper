import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenExpiry } from '@/lib/jwt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zopvish12';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    const ssoCookie = request.cookies.get('sso_session')?.value;
    let existingSessions: any[] = [];
    let activeUserId = '';
    let decoded: any = null;

    if (ssoCookie) {
      try {
        decoded = verifyToken(ssoCookie);
        if (decoded && Array.isArray(decoded.sessions)) {
          existingSessions = decoded.sessions;
        }
        activeUserId = decoded?.activeUserId || decoded?.userId || '';
      } catch (e) {}
    }

    const updatedSessions = existingSessions.filter((s: any) => s.userId !== userId);

    const response = NextResponse.json({
      message: 'Account removed from device',
      accounts: updatedSessions
    });

    const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const isLocal = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');

    if (updatedSessions.length === 0) {
      // Clear sso_session cookie
      response.cookies.set('sso_session', '', {
        httpOnly: true,
        secure: !isLocal,
        sameSite: 'lax',
        expires: new Date(0),
        path: '/'
      });
    } else {
      const topSession = updatedSessions[0];
      const newActiveUserId = activeUserId === userId ? topSession.userId : activeUserId;

      const cleanPayload = {
        activeUserId: newActiveUserId,
        userId: newActiveUserId,
        email: topSession.email,
        username: topSession.username,
        roles: topSession.roles || ['EXECUTIVE'],
        sessions: updatedSessions
      };

      const newSsoSession = jwt.sign(cleanPayload, JWT_SECRET, { expiresIn: process.env.JWT_SSO_EXPIRY || '30d' });
      const ssoExpiry = getTokenExpiry(process.env.JWT_SSO_EXPIRY || '30d');

      response.cookies.set('sso_session', newSsoSession, {
        httpOnly: true,
        secure: !isLocal,
        sameSite: 'lax',
        expires: ssoExpiry,
        path: '/'
      });
    }

    return response;
  } catch (error) {
    console.error('Remove account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
