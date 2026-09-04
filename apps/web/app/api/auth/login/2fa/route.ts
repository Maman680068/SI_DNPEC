import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL, issueSessionResponse } from '../../../../../lib/auth/session-proxy.server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { challengeToken, code } = await req.json();

  const upstream = await fetch(`${API_BASE_URL}/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken, code }),
  });
  const upstreamBody = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(upstreamBody, { status: upstream.status });
  }
  return issueSessionResponse(upstreamBody.accessToken, upstreamBody.refreshToken);
}
