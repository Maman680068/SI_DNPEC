export interface Division {
  id: string;
  code: string;
  name: string;
}

export interface Section {
  id: string;
  code: string;
  name: string;
  divisionId: string;
}

export interface Cellule {
  id: string;
  code: string;
  name: string;
  chefId: string | null;
}

export interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  role: string;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

/** Réponse de GET /users/resolve — un sous-ensemble non sensible de OrgUser
 * (ni role, ni email, ni statut), accessible hors du périmètre cascade. */
export interface BasicUserInfo {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}
