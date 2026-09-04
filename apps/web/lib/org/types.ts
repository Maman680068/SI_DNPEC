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
