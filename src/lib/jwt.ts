import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zopvish12';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  clientId?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  // Remove existing exp and iat properties to avoid conflicts
  const cleanPayload = {
    userId: payload.userId,
    email: payload.email,
    username: payload.username,
    role: payload.role
  };
  return (jwt as any).sign(cleanPayload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
}

export function generateRefreshToken(payload: TokenPayload): string {
  // Remove existing exp and iat properties to avoid conflicts
  const cleanPayload = {
    userId: payload.userId,
    email: payload.email,
    username: payload.username,
    role: payload.role
  };
  return (jwt as any).sign(cleanPayload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
}

/**
 * Specifically for UAT/External testing to avoid sharing the main JWT_SECRET
 */
export function generateUatToken(payload: Partial<TokenPayload>): string {
  const secret = process.env.UAT_JWT_SECRET;
  if (!secret) throw new Error('UAT_JWT_SECRET is not defined');
  return (jwt as any).sign(payload, secret, { expiresIn: '1h' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

/**
 * Specifically for UAT/External testing to avoid sharing the main JWT_SECRET
 */
export function verifyUatToken(token: string): any {
  const secret = process.env.UAT_JWT_SECRET;
  if (!secret) throw new Error('UAT_JWT_SECRET is not defined');
  return jwt.verify(token, secret);
}

export function getTokenExpiry(expiry: string): Date {
  const now = new Date();

  if (expiry.includes('m')) {
    const minutes = parseInt(expiry.replace('m', ''));
    return new Date(now.getTime() + minutes * 60 * 1000);
  } else if (expiry.includes('d')) {
    const days = parseInt(expiry.replace('d', ''));
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  } else if (expiry.includes('h')) {
    const hours = parseInt(expiry.replace('h', ''));
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  // Default to 15 minutes
  return new Date(now.getTime() + 15 * 60 * 1000);
}
