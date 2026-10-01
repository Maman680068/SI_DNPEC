'use client';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Code métier stable renvoyé par l'API (ex. REAUTH_REQUISE, CODE_2FA_REQUIS). */
    public readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * Réauthentification avant un objet protégé (socle N2) : la preuve renvoyée par l'API vit en
 * mémoire seulement (jamais en stockage), le temps de sa validité, et part dans l'en-tête X-Reauth.
 * Sur un refus « REAUTH_REQUISE », la fenêtre « Confirmez votre identité » s'ouvre (ReauthProvider),
 * puis la requête est rejouée une fois.
 */
let preuve: { jeton: string; expire: number } | null = null;
let demanderReauth: () => Promise<boolean> = async () => false;

export function registerReauthHook(demander: () => Promise<boolean>): void {
  demanderReauth = demander;
}
export function definirPreuve(jeton: string, expireLe: string): void {
  preuve = { jeton, expire: new Date(expireLe).getTime() };
}
export function effacerPreuve(): void {
  preuve = null;
}
function preuveValide(): string | null {
  return preuve && preuve.expire > Date.now() + 5000 ? preuve.jeton : null;
}
/** Ouvre la fenêtre de réauthentification (bouton « Afficher les données protégées »). */
export function demanderReauthentification(): Promise<boolean> {
  return demanderReauth();
}
export const CODE_REAUTH_REQUISE = 'REAUTH_REQUISE';

type TokenGetter = () => string | null;
type Refresher = () => Promise<string | null>;
type InterimGetter = () => string | null;
type InterimRejectedHandler = (message: string) => void;

let getAccessToken: TokenGetter = () => null;
let refreshAccessToken: Refresher = async () => null;
let getInterimFor: InterimGetter = () => null;
let onInterimRejected: InterimRejectedHandler = () => {};

/** Branché une seule fois par AuthProvider au montage — évite un import circulaire lib/api <-> lib/auth. */
export function registerAuthHooks(getter: TokenGetter, refresher: Refresher): void {
  getAccessToken = getter;
  refreshAccessToken = refresher;
}

/**
 * Suppléance/intérim (§4.10) — branché par InterimProvider, même principe que
 * registerAuthHooks. `getter` renvoie l'id du titulaire au nom de qui l'onglet
 * agit (ou null) : posé en en-tête X-Interim-For sur CHAQUE requête, jamais
 * de façon ambiante côté serveur. `onRejected` est appelé quand l'API refuse
 * cet intérim (suppléance expirée, révoquée ou non conforme) — le mode est
 * alors quitté immédiatement plutôt que de laisser l'onglet dans un état où
 * toutes les requêtes échouent.
 */
export function registerInterimHooks(getter: InterimGetter, onRejected: InterimRejectedHandler): void {
  getInterimFor = getter;
  onInterimRejected = onRejected;
}

/** Messages de refus de JwtAuthGuard propres à l'en-tête X-Interim-For. */
const INTERIM_REJECTION_PATTERNS = ['Aucune suppléance active', 'rang comparable'];

/** En-têtes d'authentification (jeton + intérim éventuel) — pour les appels hors
 * apiFetch (téléchargement de fichier en blob, exports), qui doivent agir avec
 * exactement la même identité que le reste de l'écran. */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const interimFor = getInterimFor();
  if (interimFor) headers['X-Interim-For'] = interimFor;
  const p = preuveValide();
  if (p) headers['X-Reauth'] = p;
  return headers;
}

/** Message affiché quand le navigateur n'obtient aucune réponse lisible de l'API
 * (serveur arrêté ou en redémarrage, adresse de l'API erronée, origine refusée par
 * CORS) — au lieu du « Failed to fetch » brut du navigateur. */
export const MESSAGE_API_INJOIGNABLE =
  'Le serveur de l’application ne répond pas. Réessayez dans un instant ; si le problème persiste, prévenez l’administrateur système.';

/** fetch vers l'API NestJS : une erreur réseau devient une ApiError (statut 0) au message français. */
export async function appelApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, MESSAGE_API_INJOIGNABLE);
  }
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
export type ApiInit = RequestInit & {
  /** N'envoie PAS X-Interim-For : requête faite en son nom propre même pendant un
   * intérim (ex. lister ses propres suppléances pour construire le sélecteur). */
  skipInterim?: boolean;
};

export async function apiFetch<T>(path: string, init: ApiInit = {}, isRetry = false, reauthRejouee = false): Promise<T> {
  const token = getAccessToken();
  const { skipInterim, ...requestInit } = init;
  const interimFor = skipInterim ? null : getInterimFor();
  const headers = new Headers(requestInit.headers);
  // FormData (upload de fichier) : jamais fixer Content-Type nous-mêmes — le
  // navigateur doit poser le boundary multipart lui-même à partir du body réel.
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (interimFor) headers.set('X-Interim-For', interimFor);
  const p = preuveValide();
  if (p) headers.set('X-Reauth', p);

  const res = await appelApi(`${API_BASE_URL}${path}`, { ...requestInit, headers });

  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch<T>(path, init, true, reauthRejouee);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    const raw = (body as { message?: string | string[] })?.message;
    const message = Array.isArray(raw) ? raw.join(', ') : raw ?? res.statusText;
    const code = (body as { code?: string })?.code;
    if (res.status === 403 && code === CODE_REAUTH_REQUISE && !reauthRejouee) {
      effacerPreuve();
      if (await demanderReauth()) return apiFetch<T>(path, init, isRetry, true);
    }
    if (res.status === 403 && interimFor && INTERIM_REJECTION_PATTERNS.some((p) => message.includes(p))) {
      onInterimRejected(message);
    }
    throw new ApiError(res.status, message, code);
  }
  return body as T;
}

/** Télécharge un flux binaire (hors apiFetch : pas du JSON) avec la même
 * identité que l'écran, via une URL d'objet temporaire ; un refus de l'API
 * remonte avec SON message (ex. 403 d'un contenu réservé). */
export async function telechargerFichier(path: string, fileName: string | null, reauthRejouee = false): Promise<void> {
  const res = await appelApi(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    let message = 'Téléchargement impossible';
    let code: string | undefined;
    try {
      const body = (await res.json()) as { message?: string | string[]; code?: string };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      code = body.code;
    } catch {
      // corps non JSON : message générique
    }
    if (res.status === 403 && code === CODE_REAUTH_REQUISE && !reauthRejouee) {
      effacerPreuve();
      if (await demanderReauth()) return telechargerFichier(path, fileName, true);
    }
    throw new ApiError(res.status, message, code);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // Sans nom imposé par l'écran : celui que le serveur annonce.
  const annonce = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1];
  link.download = fileName ?? (annonce ? decodeURIComponent(annonce) : 'document');
  link.click();
  URL.revokeObjectURL(url);
}
