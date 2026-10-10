import { NextResponse } from 'next/server';

// Redirección rápida si no hay cookie de sesión. La validación real ocurre en cada API.
export function middleware(req) {
  if (!req.cookies.get('lpa_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
}
export const config = { matcher: ['/', '/audit/:path*', '/week', '/findings', '/dashboard', '/admin'] };
