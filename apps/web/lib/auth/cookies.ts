export const REFRESH_TOKEN_COOKIE = 'dnpec_refresh_token';

/** path='/' est nécessaire : middleware.ts vérifie la présence de ce cookie sur des
 * requêtes de page (ex. /dashboard), pas seulement sur /api/auth/*. Un scope restreint
 * à /api/auth empêcherait le navigateur de l'envoyer sur ces requêtes, cassant cette
 * vérification — httpOnly + Secure + SameSite=Strict suffisent déjà à le protéger. */
export const REFRESH_TOKEN_COOKIE_PATH = '/';

export function refreshTokenCookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: REFRESH_TOKEN_COOKIE_PATH,
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  };
}

// L'API ne fixe elle-même aucune expiration de session (UserSession vit jusqu'à révocation
// explicite — voir SessionService) : cette valeur borne seulement la durée de vie du cookie
// navigateur, par défense en profondeur.
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
