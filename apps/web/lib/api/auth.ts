import type { AuthUser, LoginProxyResult, RegistrationOrgOptions } from '../auth/types';

const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function assertOk(res: Response, body: unknown): Promise<void> {
  if (!res.ok) {
    const message = (body as { message?: string | string[] })?.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message ?? res.statusText);
  }
}

/** Toutes ces fonctions (sauf setupTwoFaRequest) appellent les Route Handlers same-origin
 * app/api/auth/* — jamais l'API NestJS directement — car leur réponse amont contient un
 * refresh token que ces proxys interceptent pour le poser en cookie httpOnly. */

/** Appel direct à l'API réelle, comme setupTwoFaRequest : aucun token en jeu dans
 * la réponse (juste un message), donc pas besoin d'un proxy Route Handler. */
export async function registerRequest(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  declaredDivisionId?: string;
  declaredSectionId?: string;
  declaredCelluleId?: string;
}): Promise<{ message: string }> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as { message: string };
}

export async function getRegistrationOrgOptionsRequest(): Promise<RegistrationOrgOptions> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/auth/register/org-options`);
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as RegistrationOrgOptions;
}

export async function forgotPasswordRequest(email: string): Promise<{ message: string }> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as { message: string };
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as { message: string };
}

export async function loginRequest(email: string, password: string): Promise<LoginProxyResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as LoginProxyResult;
}

export async function loginTwoFaRequest(
  challengeToken: string,
  code: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const res = await fetch('/api/auth/login/2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken, code }),
  });
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as { accessToken: string; user: AuthUser };
}

export async function enableTwoFaRequest(
  setupToken: string,
  code: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const res = await fetch('/api/auth/2fa/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${setupToken}` },
    body: JSON.stringify({ code }),
  });
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as { accessToken: string; user: AuthUser };
}

/** Seul appel direct à l'API réelle avant l'existence d'une session : la réponse
 * (secret TOTP + QR code) ne contient aucun token, donc pas besoin de passer par un proxy. */
export async function setupTwoFaRequest(
  bearerToken: string,
): Promise<{ secret: string; otpAuthUrl: string; qrCodeDataUrl: string }> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as { secret: string; otpAuthUrl: string; qrCodeDataUrl: string };
}

export async function refreshRequest(): Promise<{ accessToken: string; user: AuthUser } | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  if (res.status === 401) return null;
  const body = await parseJson(res);
  await assertOk(res, body);
  return body as { accessToken: string; user: AuthUser };
}

export async function logoutRequest(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function logoutAllRequest(bearerToken: string): Promise<void> {
  await fetch('/api/auth/logout-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}
