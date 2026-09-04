import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/auth/session-proxy.server';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH } from '../../../../lib/auth/cookies';

/** Révoque toutes les sessions de l'utilisateur (RF-SEC-05) — y compris la session
 * courante, donc on efface systématiquement le cookie local ensuite. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const authorization = req.headers.get('authorization');
  if (authorization) {
    await fetch(`${API_BASE_URL}/auth/logout-all`, {
      method: 'POST',
      headers: { Authorization: authorization },
    }).catch(() => undefined);
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete({ name: REFRESH_TOKEN_COOKIE, path: REFRESH_TOKEN_COOKIE_PATH });
  return res;
}
