/**
 * Toutes les valeurs signées avec JWT_ACCESS_SECRET (voir CommonModule)
 * portent un claim `purpose` discriminant. C'est la seule chose qui
 * empêche un jeton intermédiaire (challenge 2FA, configuration 2FA
 * requise — courte durée de vie, émis par AuthService) d'être accepté
 * comme un vrai jeton d'accès par JwtAuthGuard : sans ce contrôle, un
 * utilisateur dont le rôle exige la 2FA pourrait contourner l'exigence
 * en réutilisant son jeton de challenge sur n'importe quelle route.
 */
export type AccessTokenPayload = { sub: string; purpose: 'access' };
export type TwoFaLoginChallengePayload = { sub: string; purpose: 'two_fa_login_challenge' };
export type TwoFaSetupRequiredPayload = { sub: string; purpose: 'two_fa_setup_required' };

export type AnyAuthTokenPayload =
  | AccessTokenPayload
  | TwoFaLoginChallengePayload
  | TwoFaSetupRequiredPayload;
