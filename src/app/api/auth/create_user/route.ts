import { NextRequest, NextResponse } from 'next/server';

// This endpoint is currently disabled
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is currently disabled' },
    { status: 403 }
  );
}
