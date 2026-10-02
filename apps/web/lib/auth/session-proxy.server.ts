import { NextResponse } from 'next/server';
import { REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions, REFRESH_TOKEN_MAX_AGE_SECONDS } from './cookies';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

/** Utilisé uniquement par les Route Handlers server-side (app/api/auth/*). */
export async function fetchCurrentUser(accessToken: string): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

/** Construit la réponse { accessToken, user } côté navigateur et pose le refresh token
 * en cookie httpOnly — jamais l'inverse. */
export async function issueSessionResponse(accessToken: string, refreshToken: string): Promise<NextResponse> {
  const user = await fetchCurrentUser(accessToken);
  const res = NextResponse.json({ status: 'authenticated', accessToken, user });
  res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS));
  return res;
}

/** En-têtes qui transmettent à l'API l'adresse et le navigateur du client d'une connexion relayée
 * (revue de sécurité 2026-10) : sans eux, toutes les connexions viendraient de l'adresse du
 * serveur web, et quelques échecs verrouilleraient tout le monde. L'API ne croit l'adresse
 * transmise qu'avec le secret partagé WEB_PROXY_SECRET (voir apps/api/src/common/security/client-ip.ts). */
export function entetesClient(req: Request): Record<string, string> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  // Adresse inconnue : l'en-tête part sans le secret, et l'API n'applique alors que le
  // verrouillage par compte (jamais un verrou commun à toutes les connexions).
  const h: Record<string, string> = { 'X-Client-IP': ip || 'inconnue' };
  const navigateur = req.headers.get('user-agent');
  if (navigateur) h['User-Agent'] = navigateur;
  if (ip && process.env.WEB_PROXY_SECRET) h['X-Proxy-Secret'] = process.env.WEB_PROXY_SECRET;
  return h;
}

export { API_BASE_URL };
