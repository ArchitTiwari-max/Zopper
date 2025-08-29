import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {

    // Create response
    const response = NextResponse.json({
      message: 'Logout successful'
    });

    // Clear cookies
    response.cookies.set('accessToken', '', {
      httpOnly: true,
      secure: false, // Set to false for development (localhost)
      sameSite: 'lax',
      expires: new Date(0),
      path: '/'
    });

    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: false, // Set to false for development (localhost)
      sameSite: 'lax',
      expires: new Date(0),
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
