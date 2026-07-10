import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, verifyToken } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: any = {};
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    } else {
      body = await request.json();
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Failed to parse request body' },
      { status: 400 }
    );
  }

  // Support both body variables and Basic Authorization Header for client credentials
  let clientId = body.client_id;
  let clientSecret = body.client_secret;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
    try {
      const credentials = Buffer.from(authHeader.substring(6), 'base64')
        .toString('ascii')
        .split(':');
      clientId = credentials[0];
      clientSecret = credentials[1];
    } catch (e) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Invalid basic authorization header' },
        { status: 400 }
      );
    }
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Missing client credentials' },
      { status: 400 }
    );
  }

  try {
    // 1. Verify Client
    const client = await prisma.client.findUnique({
      where: { clientId },
    });

    if (!client || client.clientSecret !== clientSecret) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client credentials' },
        { status: 400 }
      );
    }

    const grantType = body.grant_type;

    // 2. Handle Authorization Code Grant Flow
    if (grantType === 'authorization_code') {
      const code = body.code;
      const redirectUri = body.redirect_uri;

      if (!code || !redirectUri) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing code or redirect_uri' },
          { status: 400 }
        );
      }

      // Fetch code record
      const authCodeRecord = await prisma.authorizationCode.findUnique({
        where: { code },
      });

      // Validate code record
      if (
        !authCodeRecord ||
        authCodeRecord.used ||
        authCodeRecord.expiresAt < new Date() ||
        authCodeRecord.clientId !== clientId ||
        authCodeRecord.redirectUri !== redirectUri
      ) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid, expired, or already used authorization code' },
          { status: 400 }
        );
      }

      // Mark the code as used immediately to prevent replay attacks
      await prisma.authorizationCode.update({
        where: { id: authCodeRecord.id },
        data: { used: true },
      });

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: authCodeRecord.userId },
      });

      if (!user || !user.isActive) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'User not found or is deactivated' },
          { status: 400 }
        );
      }

      // Generate Access Token and Refresh Token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        roles: user.roles && user.roles.length > 0 ? user.roles : ['EXECUTIVE'],
        clientId: clientId,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      return NextResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes (or match JWT_ACCESS_EXPIRY config)
      });
    }

    // 3. Handle Refresh Token Flow
    if (grantType === 'refresh_token') {
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing refresh_token' },
          { status: 400 }
        );
      }

      try {
        // Verify refresh token
        const payload = verifyToken(refreshToken);

        // Ensure token was issued to this client
        if (payload.clientId !== clientId) {
          return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Token client mismatch' },
            { status: 400 }
          );
        }

        // Fetch current user details from DB
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (!user || !user.isActive) {
          return NextResponse.json(
            { error: 'invalid_grant', error_description: 'User is inactive or not found' },
            { status: 400 }
          );
        }

        // Generate new Access and Refresh tokens
        const tokenPayload = {
          userId: user.id,
          email: user.email,
          username: user.username,
          roles: user.roles && user.roles.length > 0 ? user.roles : ['EXECUTIVE'],
          clientId: clientId,
        };

        const newAccessToken = generateAccessToken(tokenPayload);
        const newRefreshToken = generateRefreshToken(tokenPayload);

        return NextResponse.json({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          token_type: 'Bearer',
          expires_in: 900,
        });
      } catch (err) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired refresh token' },
          { status: 400 }
        );
      }
    }

    // Unsupported grant type
    return NextResponse.json(
      { error: 'unsupported_grant_type', error_description: 'Grant type must be authorization_code or refresh_token' },
      { status: 400 }
    );

  } catch (error) {
    console.error('OAuth Token Exchange Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error during token exchange' },
      { status: 500 }
    );
  }
}
