import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const start = Date.now()
  
  // Log incoming request
  console.log(`[MIDDLEWARE] ${request.method} ${request.nextUrl.pathname}`)
  
  const response = NextResponse.next()
  
  const duration = Date.now() - start
  console.log(`[MIDDLEWARE] Completed ${request.method} ${request.nextUrl.pathname} (${duration}ms)`)
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
