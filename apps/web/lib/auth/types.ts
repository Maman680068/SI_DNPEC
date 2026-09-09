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

/** Réponse de GET /auth/register/org-options (public, avant authentification) —
 * les seuls choix de rattachement déclarable à l'inscription : les 5 Divisions
 * avec leurs Sections, et les Cellules dont la structure est définie (CTSCM/CNC
 * exclues côté API, voir AuthService.DECLARABLE_CELLULE_CODES). */
export interface RegistrationDivisionOption {
  id: string;
  code: string;
  name: string;
  sections: { id: string; code: string; name: string }[];
}

export interface RegistrationCelluleOption {
  id: string;
  code: string;
  name: string;
}

export interface RegistrationOrgOptions {
  divisions: RegistrationDivisionOption[];
  cellules: RegistrationCelluleOption[];
}

/** Réponse de GET /auth/register/supervisor-options (public) — les personnes
 * pouvant être déclarées "assistées" à l'inscription : DN, DNA et Chefs de
 * Cellule ACTIFS. celluleName n'est renseigné que pour un CHEF_CELLULE. */
export interface RegistrationSupervisorOption {
  id: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  celluleName: string | null;
}
