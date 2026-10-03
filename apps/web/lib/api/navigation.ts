import { apiFetch } from './client';

/** Compteurs du menu (refonte de l'interface) : calculés par l'API avec les droits de chaque écran. */
export interface CompteursNavigation {
  taches: number;
  tachesAValider: number;
  messages: number;
  instructions: number;
  reunions: number;
  conges: number;
  courrier: number;
  logistique: number;
  utilisateurs: number;
  stages: number;
}
/** Élément « À traiter » du tableau de bord (jamais à zéro). */
export interface ATraiter {
  cle: string;
  libelle: string;
  nombre: number;
  lien: string;
}
export interface Navigation {
  compteurs: CompteursNavigation;
  aTraiter: ATraiter[];
  /** Entrées du menu « Créer » ouvertes au rôle. */
  creer: { tache: boolean; reunion: boolean; conge: boolean; message: boolean; document: boolean };
  /** La personne voit d'autres tâches que les siennes (onglet « Mon périmètre »). */
  perimetre: boolean;
}

export const getNavigation = () => apiFetch<Navigation>('/api/v1/navigation');
