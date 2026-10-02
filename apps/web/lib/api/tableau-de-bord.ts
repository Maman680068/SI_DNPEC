import { apiFetch } from './client';

export interface ElementBloc {
  libelle: string;
  detail?: string | null;
  lien?: string | null;
}
export interface BlocTableau {
  cle: string;
  titre: string;
  valeur?: number | null;
  sousTitre?: string | null;
  elements?: ElementBloc[];
  lien?: string | null;
  vide?: string;
}
export interface TableauRole {
  profil: string;
  blocs: BlocTableau[];
}

/** Tableau de bord par rôle (socle N6) : blocs choisis et filtrés par l'API. */
export const getTableauRole = () => apiFetch<TableauRole>('/api/v1/tableau-de-bord');
