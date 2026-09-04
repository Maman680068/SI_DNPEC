import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL, issueSessionResponse } from '../../../../../lib/auth/session-proxy.server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authorization = req.headers.get('authorization');
  if (!authorization) return NextResponse.json({ message: 'Jeton manquant' }, { status: 401 });

  const { code } = await req.json();

  const upstream = await fetch(`${API_BASE_URL}/auth/2fa/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify({ code }),
  });
  const upstreamBody = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(upstreamBody, { status: upstream.status });
  }
  return issueSessionResponse(upstreamBody.accessToken, upstreamBody.refreshToken);
}
