import { apiFetch } from './client';
import type { BasicUserInfo, Division, Section, Cellule, DirectoryUser, OrgUser } from '../org/types';

export function getDivisions(): Promise<Division[]> {
  return apiFetch<Division[]>('/org/divisions');
}

export function getSections(divisionId: string): Promise<Section[]> {
  return apiFetch<Section[]>(`/org/divisions/${divisionId}/sections`);
}

export function getCellules(): Promise<Cellule[]> {
  return apiFetch<Cellule[]>('/org/cellules');
}

export interface OrgEntityInput {
  code: string;
  name: string;
}

export function createDivision(input: OrgEntityInput): Promise<Division> {
  return apiFetch<Division>('/org/divisions', { method: 'POST', body: JSON.stringify(input) });
}

export function updateDivision(id: string, input: Partial<OrgEntityInput>): Promise<Division> {
  return apiFetch<Division>(`/org/divisions/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** L'API refuse (409) si la Division a encore des Sections, utilisateurs ou tâches
 * rattachés — voir DivisionsService.remove. Le message d'erreur est déjà clair,
 * à afficher tel quel (ApiError.message). */
export function deleteDivision(id: string): Promise<void> {
  return apiFetch<void>(`/org/divisions/${id}`, { method: 'DELETE' });
}

export function createSection(divisionId: string, input: OrgEntityInput): Promise<Section> {
  return apiFetch<Section>(`/org/divisions/${divisionId}/sections`, { method: 'POST', body: JSON.stringify(input) });
}

export function updateSection(id: string, input: Partial<OrgEntityInput>): Promise<Section> {
  return apiFetch<Section>(`/org/sections/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** Même garde que deleteDivision, côté SectionsService.remove. */
export function deleteSection(id: string): Promise<void> {
  return apiFetch<void>(`/org/sections/${id}`, { method: 'DELETE' });
}

/** Suspension (§2.3) : n'affecte jamais les personnes déjà rattachées à la Section
 * (accès intact), bloque seulement un nouveau rattachement ou une nouvelle nomination
 * de chef — voir SectionsService.suspend côté API. */
export function suspendSection(id: string): Promise<Section> {
  return apiFetch<Section>(`/org/sections/${id}/suspend`, { method: 'POST' });
}

export function reactivateSection(id: string): Promise<Section> {
  return apiFetch<Section>(`/org/sections/${id}/reactivate`, { method: 'POST' });
}

export function createCellule(input: OrgEntityInput): Promise<Cellule> {
  return apiFetch<Cellule>('/org/cellules', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCellule(id: string, input: Partial<OrgEntityInput>): Promise<Cellule> {
  return apiFetch<Cellule>(`/org/cellules/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** Même garde que deleteDivision, côté CellulesService.remove. */
export function deleteCellule(id: string): Promise<void> {
  return apiFetch<void>(`/org/cellules/${id}`, { method: 'DELETE' });
}

/** Voir suspendSection — même principe pour une Division. */
export function suspendDivision(id: string): Promise<Division> {
  return apiFetch<Division>(`/org/divisions/${id}/suspend`, { method: 'POST' });
}

export function reactivateDivision(id: string): Promise<Division> {
  return apiFetch<Division>(`/org/divisions/${id}/reactivate`, { method: 'POST' });
}

/** Voir suspendSection — même principe pour une Cellule. Le chef en poste, s'il y en
 * a un, garde son rôle : seule une NOUVELLE nomination de chef est bloquée. */
export function suspendCellule(id: string): Promise<Cellule> {
  return apiFetch<Cellule>(`/org/cellules/${id}/suspend`, { method: 'POST' });
}

export function reactivateCellule(id: string): Promise<Cellule> {
  return apiFetch<Cellule>(`/org/cellules/${id}/reactivate`, { method: 'POST' });
}

/** Nomme le chef d'une cellule — même mécanisme que tout changement de rôle
 * (POST /org/cellules/:id/chef, RoleChangeService) : motif obligatoire, refus 409
 * si la cellule a déjà un chef (jamais de rétrogradation automatique), historique
 * de carrière, audit, sessions de la personne fermées. */
export function assignCelluleChef(celluleId: string, userId: string, motif: string): Promise<unknown> {
  return apiFetch<unknown>(`/org/cellules/${celluleId}/chef`, { method: 'POST', body: JSON.stringify({ userId, motif }) });
}

/** Retire le chef d'une cellule : il y reste avec le rôle cible (Chargé d'Études par défaut). */
export function retirerCelluleChef(celluleId: string, motif: string, role?: string): Promise<unknown> {
  return apiFetch<unknown>(`/org/cellules/${celluleId}/chef/retrait`, { method: 'POST', body: JSON.stringify({ motif, role }) });
}

/** Scopé par le périmètre cascade de l'acteur (ex. un Agent ne voit que lui-même) —
 * voir CascadeService.getVisibleUserWhere côté API. Source des listes de sélection
 * (assignation, mention) : volontairement bornée à ce périmètre. */
export function getUsers(): Promise<OrgUser[]> {
  return apiFetch<OrgUser[]>('/users');
}

/** Résolution de noms hors périmètre cascade (GET /users/resolve) — pour l'affichage
 * uniquement (co-responsable, auteur de commentaire, mention), jamais pour peupler une
 * liste de sélection. Champs non sensibles uniquement (ni rôle, ni email, ni statut). */
export function resolveUsers(ids: string[]): Promise<BasicUserInfo[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return apiFetch<BasicUserInfo[]>(`/users/resolve?ids=${ids.map(encodeURIComponent).join(',')}`);
}

/** Recherche par nom hors périmètre cascade (GET /users/search) — pour trouver un
 * destinataire de message (RF-COM-01, sans restriction hiérarchique). Comptes actifs
 * uniquement, mêmes champs non sensibles que resolveUsers. */
export function searchUsers(query: string): Promise<BasicUserInfo[]> {
  if (!query.trim()) return Promise.resolve([]);
  return apiFetch<BasicUserInfo[]>(`/users/search?q=${encodeURIComponent(query.trim())}`);
}

/** Annuaire du personnel (RF-CPL-02, GET /users/directory) — tout le personnel actif,
 * hors périmètre cascade. Élargit la visibilité, pas les droits d'action : les actions
 * lancées depuis l'Annuaire (message, assignation de tâche) restent soumises aux mêmes
 * contrôles d'autorité que partout ailleurs, appliqués côté serveur. */
export function getDirectory(): Promise<DirectoryUser[]> {
  return apiFetch<DirectoryUser[]>('/users/directory');
}

/** Personne trouvée par la recherche de la messagerie et de l'annuaire (api/v1/personnes/recherche). */
export interface PersonneTrouvee {
  id: string;
  prenom: string;
  nom: string;
  fonction: string | null;
  unite: string | null;
  uniteLibelle: string | null;
  conversation: boolean;
}
/** Sans texte : correspondants récents puis tout le personnel ; avec texte : résultats triés par l'API. */
export function rechercherPersonnes(q: string): Promise<{ recents: PersonneTrouvee[]; personnes: PersonneTrouvee[] }> {
  return apiFetch(`/api/v1/personnes/recherche?q=${encodeURIComponent(q.trim())}`);
}

/** Annuaire repensé (S4, api/v1/annuaire) : personnes, unités, état du jour, résultats de recherche. */
export type EtatDuJour = 'EN_CONGE' | 'EN_MISSION' | null;
export interface PersonneAnnuaireV1 {
  id: string;
  prenom: string;
  nom: string;
  fonction: string;
  section: string | null;
  sigle: string | null;
  bloc: string;
  badge: string | null;
  etat: EtatDuJour;
  supplee: string | null;
}
export interface UniteAnnuaire {
  id: string;
  sigle: string;
  libelle: string;
  type: string;
  chef: string | null;
  nombre: number;
  membres: string[];
}
export interface Annuaire {
  disponibles: number;
  total: number;
  personnes: PersonneAnnuaireV1[];
  unites: UniteAnnuaire[];
  resultats: string[] | null;
}
export interface FicheAnnuaire {
  id: string;
  prenom: string;
  nom: string;
  fonction: string;
  unite: string;
  rendCompteA: string[];
  suppleant: string | null;
  supplee: string | null;
  etat: EtatDuJour;
  equipe: { id: string; nom: string }[];
  peutEcrire: boolean;
  peutAssigner: boolean;
}
export const getAnnuaire = (q = '') => apiFetch<Annuaire>(`/api/v1/annuaire?q=${encodeURIComponent(q.trim())}`);
export const getFicheAnnuaire = (id: string) => apiFetch<FicheAnnuaire>(`/api/v1/annuaire/${encodeURIComponent(id)}`);

/** Organisation (S8, api/v1/organisation) : vue des trois onglets, calculée par l'API. */
export interface ChefVue {
  id: string;
  nom: string;
  suppleant: string | null;
}
export interface MembreVue {
  id: string;
  nom: string;
  initiales: string;
}
export interface SectionVue {
  id: string;
  code: string;
  nom: string;
  actif: boolean;
  chef: ChefVue | null;
  agents: number;
  etat: 'COMPLETE' | 'CHEF_A_DESIGNER' | 'SANS_AGENT';
  equipe: MembreVue[];
}
export interface DivisionVue {
  id: string;
  code: string;
  nom: string;
  actif: boolean;
  chef: ChefVue | null;
  agents: number;
  enConge: number;
  sectionsActives: number;
  sectionsSansChef: number;
  agentsSansSection: { id: string; nom: string }[];
  chefsDesignes: number;
  postesChef: number;
  sections: SectionVue[];
  equipe: MembreVue[];
}
export interface CelluleVue {
  id: string;
  code: string;
  nom: string;
  actif: boolean;
  nature: 'CELLULE' | 'SERVICE' | 'INSTANCE';
  libelleNature: string;
  rattachement: 'DN' | 'DNA';
  chef: ChefVue | null;
  agents: number;
  enConge: number;
  membresExternes: boolean;
  roles: string[];
  equipe: MembreVue[];
}
export interface VueOrganisation {
  direction: { dn: ChefVue | null; dna: ChefVue | null; chargesAupresDn: MembreVue[] };
  divisions: DivisionVue[];
  cellules: CelluleVue[];
  chiffres: { unites: number; sansResponsable: number };
  droits: { structure: boolean; designerChef: boolean; rattachement: boolean };
}
export const getVueOrganisation = () => apiFetch<VueOrganisation>('/api/v1/organisation');
export const modifierRattachementCellule = (id: string, v: { rattachement?: 'DN' | 'DNA'; nature?: 'CELLULE' | 'SERVICE' | 'INSTANCE' }) =>
  apiFetch<VueOrganisation>(`/api/v1/organisation/cellules/${id}`, { method: 'PATCH', body: JSON.stringify(v) });
/** Affectation d'un agent à une section (PATCH /users/:id/assignment, droits de l'API inchangés). */
export const affecterSection = (userId: string, divisionId: string, sectionId: string) =>
  apiFetch(`/users/${userId}/assignment`, { method: 'PATCH', body: JSON.stringify({ divisionId, sectionId }) });
