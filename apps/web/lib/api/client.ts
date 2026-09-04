'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type TokenGetter = () => string | null;
type Refresher = () => Promise<string | null>;

let getAccessToken: TokenGetter = () => null;
let refreshAccessToken: Refresher = async () => null;

/** Branché une seule fois par AuthProvider au montage — évite un import circulaire lib/api <-> lib/auth. */
export function registerAuthHooks(getter: TokenGetter, refresher: Refresher): void {
  getAccessToken = getter;
  refreshAccessToken = refresher;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Appelle directement l'API NestJS (jamais l'API ne renvoie de refresh token sur ces
 * routes — voir lib/auth/types.ts). Sur 401, tente un unique rafraîchissement silencieux
 * via /api/auth/refresh puis rejoue la requête une fois.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch<T>(path, init, true);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    const message = (body as { message?: string | string[] })?.message;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message ?? res.statusText);
  }
  return body as T;
}
