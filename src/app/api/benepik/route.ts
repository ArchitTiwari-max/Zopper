/**
 * AWS Next.js API Route
 * Deploy this file at: src/app/api/benepik/route.ts
 * 
 * This acts as a proxy between Vercel and Benepik API
 * AWS server has static IP which is whitelisted by Benepik
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checksum, requestHeaders } = body;

    // Validate request
    if (!checksum || !requestHeaders) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing checksum or requestHeaders'
        },
        { status: 400 }
      );
    }

    // Benepik API URL
    const benepikUrl = process.env.BENEPIK_API_URL;
    if (!benepikUrl) {
      throw new Error('BENEPIK_API_URL not configured');
    }

    // Forward request to Benepik
    const response = await axios.post(
      benepikUrl,
      { checksum },
      {
        headers: {
          'Authorization': requestHeaders.Authorization,
          'REQUESTID': requestHeaders.REQUESTID,
          'X-TIMESTAMP': requestHeaders['X-TIMESTAMP'],
          'X-NONCE': requestHeaders['X-NONCE'],
          'X-SIGNATURE': requestHeaders['X-SIGNATURE'],
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Return Benepik's response
    return NextResponse.json(response.data);

  } catch (error: any) {
    console.error('AWS Proxy error:', error.response?.data || error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.message || error.message || 'Proxy request failed'
      },
      { status: error.response?.status || 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
