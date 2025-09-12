import { NextRequest, NextResponse } from 'next/server';

// DEPRECATED: This endpoint has been moved to /api/executive/store/data
// This route now redirects to the new location for backward compatibility
export async function GET(request: NextRequest) {
  // Preserve query parameters in redirect
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const newUrl = `/api/executive/store/data${searchParams ? `?${searchParams}` : ''}`;
  
  return NextResponse.redirect(new URL(newUrl, url.origin), 301);
}


// PUT endpoint redirect
export async function PUT(request: NextRequest) {
  // Preserve query parameters in redirect
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const newUrl = `/api/executive/store/data${searchParams ? `?${searchParams}` : ''}`;
  
  return NextResponse.redirect(new URL(newUrl, url.origin), 301);
}
