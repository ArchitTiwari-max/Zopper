import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const start = Date.now()
  
  const dateTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  
  // Log incoming request
  console.log(`[MIDDLEWARE] [${dateTime}] ${request.method} ${request.nextUrl.pathname}`)
  
  const response = NextResponse.next()
  
  const duration = Date.now() - start
  console.log(`[MIDDLEWARE] [${dateTime}] Completed ${request.method} ${request.nextUrl.pathname} (${duration}ms)`)
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
