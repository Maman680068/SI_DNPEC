import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/auth/session-proxy.server';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH } from '../../../../lib/auth/cookies';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete({ name: REFRESH_TOKEN_COOKIE, path: REFRESH_TOKEN_COOKIE_PATH });
  return res;
}
