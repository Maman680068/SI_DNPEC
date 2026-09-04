import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL, issueSessionResponse } from '../../../../lib/auth/session-proxy.server';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH } from '../../../../lib/auth/cookies';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: 'Aucune session' }, { status: 401 });
  }

  const upstream = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!upstream.ok) {
    const upstreamBody = await upstream.json();
    const res = NextResponse.json(upstreamBody, { status: upstream.status });
    res.cookies.delete({ name: REFRESH_TOKEN_COOKIE, path: REFRESH_TOKEN_COOKIE_PATH });
    return res;
  }

  const { accessToken, refreshToken: rotatedRefreshToken } = await upstream.json();
  return issueSessionResponse(accessToken, rotatedRefreshToken);
}
