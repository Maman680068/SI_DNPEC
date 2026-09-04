export type SystemRole =
  | 'DN'
  | 'DNA'
  | 'CHEF_DIVISION'
  | 'CHEF_SECTION'
  | 'CHEF_CELLULE'
  | 'AGENT'
  | 'ADMIN_SYSTEME'
  | 'ASSISTANT_DIRECTION';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  jobTitle: string | null;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

/** Réponse de POST /api/auth/login côté proxy Next.js (jamais le refreshToken, posé en cookie httpOnly). */
export type LoginProxyResult =
  | { status: 'authenticated'; accessToken: string; user: AuthUser }
  | { status: 'two_fa_challenge_required'; challengeToken: string }
  | { status: 'two_fa_setup_required'; setupToken: string };
