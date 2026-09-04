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
  const res = NextResponse.json({ accessToken, user });
  res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS));
  return res;
}

export { API_BASE_URL };
