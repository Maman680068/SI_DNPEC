import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL, issueSessionResponse } from '../../../../lib/auth/session-proxy.server';

/**
 * Proxy de POST /auth/login. La réponse amont peut être :
 *  - { accessToken, refreshToken } : session complète -> le refreshToken est intercepté
 *    ici (cookie httpOnly), jamais renvoyé au client.
 *  - { status: 'two_fa_challenge_required'|'two_fa_setup_required', ...Token } : pas de
 *    session encore, aucun refresh token en jeu -> transmis tel quel.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const credentials = await req.json();

  const upstream = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const upstreamBody = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(upstreamBody, { status: upstream.status });
  }
  if (upstreamBody.status) {
    return NextResponse.json(upstreamBody);
  }

  return issueSessionResponse(upstreamBody.accessToken, upstreamBody.refreshToken);
}
