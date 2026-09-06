import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_TOKEN_COOKIE } from './lib/auth/cookies';

// Redirection de confort uniquement : la présence du cookie de refresh ne prouve pas
// qu'il est encore valide côté API (il peut être expiré/révoqué). L'autorisation réelle
// reste entièrement côté API NestJS ; ici on évite juste un aller-retour visible pour
// l'utilisateur (flash de la page de login, ou d'un dashboard qui échouera aussitôt).
export function middleware(req: NextRequest) {
  const hasSessionCookie = req.cookies.has(REFRESH_TOKEN_COOKIE);
  const { pathname } = req.nextUrl;

  if (!hasSessionCookie && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (hasSessionCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
