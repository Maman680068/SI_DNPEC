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

/** Un chiffre de la bande du tableau de bord (calculé par l'API selon le profil). */
export interface ChiffreTableau {
  cle: string;
  valeur: number | string | null;
  libelle: string;
  sous: string;
  ton: 'encre' | 'rouge' | 'ambre' | 'vert';
  lien: string | null;
}
export interface ChiffresTableau {
  profil: 'DIRECTION' | 'DRH' | 'ADMINISTRATEUR' | 'ASSISTANT' | 'CHEF' | 'AGENT';
  chiffres: ChiffreTableau[];
}
/** Bande des quatre chiffres du tableau de bord, selon le profil (stagiaire compris). */
export const getChiffresTableau = () => apiFetch<ChiffresTableau>('/api/v1/tableau-de-bord/chiffres');
