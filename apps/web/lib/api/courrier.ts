import { apiFetch, telechargerFichier } from './client';
import type {
  AccesDelegue,
  Acte,
  ActeFiltres,
  Arrivee,
  ArriveeFiltres,
  Candidat,
  Compteur,
  Confidentialite,
  Delegataire,
  Habilitation,
  ImputationNature,
  Registre,
  RegistreNature,
  RegistrePortee,
  TableauDeBordCourrier,
  Unite,
} from '../courrier/types';

// Toutes les requêtes passent par apiFetch (ou authHeaders pour les fichiers) :
// l'intérim éventuel de l'onglet (X-Interim-For) s'applique partout de la même façon.

function query(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

// --- Paramétrage et tableau de bord -------------------------------------------

export const getTableauDeBord = () => apiFetch<TableauDeBordCourrier>('/courrier/tableau-de-bord');
export const getRegistres = () => apiFetch<Registre[]>('/courrier/registres');
export const getUnites = () => apiFetch<Unite[]>('/courrier/unites');
export const getMesHabilitations = () => apiFetch<(Habilitation & { registre: Registre })[]>('/courrier/habilitations/miennes');

// --- Administration (ADMIN_SYSTEME) --------------------------------------------

export interface RegistreInput {
  code: string;
  libelle: string;
  nature: RegistreNature;
  portee: RegistrePortee;
  gabaritNumero: string;
}
export const createRegistre = (input: RegistreInput) => post<Registre>('/courrier/registres', input);
export const updateRegistre = (id: string, input: Partial<Omit<RegistreInput, 'code'>> & { isActive?: boolean }) =>
  apiFetch<Registre>(`/courrier/registres/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const getHabilitations = () => apiFetch<Habilitation[]>('/courrier/habilitations');
export const createHabilitation = (input: { userId: string; registreId: string; uniteKey?: string }) =>
  post<Habilitation>('/courrier/habilitations', input);
export const revoquerHabilitation = (id: string) => post<Habilitation>(`/courrier/habilitations/${id}/revoquer`);
export const getCompteurs = (registreId: string) => apiFetch<Compteur[]>(`/courrier/registres/${registreId}/compteurs`);
export const initialiserCompteur = (registreId: string, input: { uniteKey?: string; annee: number; dernier: number }) =>
  post<Compteur>(`/courrier/registres/${registreId}/compteurs/initialiser`, input);

// --- Arrivées --------------------------------------------------------------------

export const getArrivees = (filtres: ArriveeFiltres = {}) => apiFetch<Arrivee[]>(`/courrier/arrivees${query(filtres)}`);
export const getArrivee = (id: string) => apiFetch<Arrivee>(`/courrier/arrivees/${id}`);

export interface EnregistrementInput {
  registreId: string;
  uniteKey?: string;
  dateReception: string;
  expediteur: string;
  referenceExpediteur?: string;
  dateCourrier?: string;
  objet?: string;
  confidentialite: Confidentialite;
  destinataireId?: string;
  /** Dérogation au contrôle des dates (motif obligatoire). */
  derogationDate?: boolean;
  motifDerogation?: string;
}
export function enregistrerArrivee(input: EnregistrementInput, fichiers: File[]): Promise<Arrivee> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(input)) if (v !== undefined && v !== '') fd.append(k, String(v));
  for (const f of fichiers) fd.append('files', f);
  return apiFetch<Arrivee>('/courrier/arrivees', { method: 'POST', body: fd });
}
export const corrigerArrivee = (
  id: string,
  input: Partial<
    Pick<EnregistrementInput, 'dateReception' | 'expediteur' | 'referenceExpediteur' | 'dateCourrier' | 'objet' | 'derogationDate' | 'motifDerogation'>
  >,
) => apiFetch<Arrivee>(`/courrier/arrivees/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const annulerArrivee = (id: string, motif: string) => post<Arrivee>(`/courrier/arrivees/${id}/annuler`, { motif });
export const classerArrivee = (id: string) => post<Arrivee>(`/courrier/arrivees/${id}/classer`);
export const completerPli = (id: string, objet: string) => post<Arrivee>(`/courrier/arrivees/${id}/completer`, { objet });
export const requalifierPli = (id: string, confidentialite: 'ORDINAIRE' | 'CONFIDENTIEL') =>
  post<Arrivee>(`/courrier/arrivees/${id}/requalifier`, { confidentialite });
export function ajouterPiecesArrivee(id: string, fichiers: File[]): Promise<Arrivee> {
  const fd = new FormData();
  for (const f of fichiers) fd.append('files', f);
  return apiFetch<Arrivee>(`/courrier/arrivees/${id}/pieces`, { method: 'POST', body: fd });
}

// --- Imputations -----------------------------------------------------------------

export interface ImputationInput {
  imputeAId: string;
  nature: ImputationNature;
  instructions?: string;
  echeance?: string;
}
export const getImputables = (cible: { arriveeId: string } | { imputationId: string }) =>
  apiFetch<Candidat[]>(`/courrier/imputables${query(cible)}`);
export const imputer = (arriveeId: string, input: ImputationInput) => post<{ id: string }>(`/courrier/arrivees/${arriveeId}/imputations`, input);
export const sousImputer = (imputationId: string, input: ImputationInput) =>
  post<{ id: string }>(`/courrier/imputations/${imputationId}/sous-imputations`, input);
export const traiterImputation = (imputationId: string, input: { compteRendu?: string; reponseActeId?: string }) =>
  post<Arrivee>(`/courrier/imputations/${imputationId}/traiter`, input);
export const convertirEnTache = (imputationId: string, input: { titre?: string; dueDate?: string }) =>
  post<Arrivee>(`/courrier/imputations/${imputationId}/convertir-en-tache`, input);

// --- Accès délégués --------------------------------------------------------------

export type CibleCourrier = { arriveeId: string } | { acteId: string };
const accesPath = (c: CibleCourrier) =>
  'arriveeId' in c ? `/courrier/arrivees/${c.arriveeId}/acces-delegues` : `/courrier/actes/${c.acteId}/acces-delegues`;
export const getAccesDelegues = (c: CibleCourrier) => apiFetch<AccesDelegue[]>(accesPath(c));
export const getDelegatairesPossibles = (c: CibleCourrier) => apiFetch<Delegataire[]>(`/courrier/delegataires-possibles${query(c)}`);
export const ouvrirAcces = (c: CibleCourrier, beneficiaireId: string) => post<AccesDelegue>(accesPath(c), { beneficiaireId });
export const revoquerAcces = (id: string) => post<AccesDelegue>(`/courrier/acces-delegues/${id}/revoquer`);

// --- Actes -----------------------------------------------------------------------

export interface ActeInput {
  registreId: string;
  objet: string;
  destinataires?: string;
  corps?: string;
  confidentialite: 'ORDINAIRE' | 'CONFIDENTIEL';
  beneficiaireId?: string;
  priseConnaissanceRequise?: boolean;
  repondAId?: string;
}
export const getActes = (filtres: ActeFiltres = {}) => apiFetch<Acte[]>(`/courrier/actes${query(filtres)}`);
export const getActe = (id: string) => apiFetch<Acte>(`/courrier/actes/${id}`);
export const creerActe = (input: ActeInput) => post<Acte>('/courrier/actes', input);
export const modifierActe = (id: string, input: Partial<ActeInput>) =>
  apiFetch<Acte>(`/courrier/actes/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const supprimerActe = (id: string) => apiFetch<void>(`/courrier/actes/${id}`, { method: 'DELETE' });
export const soumettreActe = (id: string) => post<Acte>(`/courrier/actes/${id}/soumettre`);
export const viserActe = (id: string, commentaire?: string) => post<Acte>(`/courrier/actes/${id}/viser`, { commentaire: commentaire || undefined });
export const renvoyerActe = (id: string, motif: string) => post<Acte>(`/courrier/actes/${id}/renvoyer`, { motif });
export function signerActe(id: string, scan?: File | null): Promise<Acte> {
  const fd = new FormData();
  if (scan) fd.append('file', scan);
  return apiFetch<Acte>(`/courrier/actes/${id}/signer`, { method: 'POST', body: fd });
}
export const expedierActe = (id: string, modeExpedition: string) => post<Acte>(`/courrier/actes/${id}/expedier`, { modeExpedition });
export const annulerActe = (id: string, motif: string) => post<Acte>(`/courrier/actes/${id}/annuler`, { motif });
export const prendreConnaissance = (id: string) => post<Acte>(`/courrier/actes/${id}/prise-de-connaissance`);
export function ajouterPiecesActe(id: string, fichiers: File[]): Promise<Acte> {
  const fd = new FormData();
  for (const f of fichiers) fd.append('files', f);
  return apiFetch<Acte>(`/courrier/actes/${id}/pieces`, { method: 'POST', body: fd });
}

// --- Fichiers (flux binaires, hors apiFetch) ------------------------------------

const telecharger = telechargerFichier;

export const telechargerPieceArrivee = (arriveeId: string, pieceId: string, fileName: string) =>
  telecharger(`/courrier/arrivees/${arriveeId}/pieces/${pieceId}/download`, fileName);
export const telechargerPieceActe = (acteId: string, pieceId: string, fileName: string) =>
  telecharger(`/courrier/actes/${acteId}/pieces/${pieceId}/download`, fileName);
const jour = () => new Date().toISOString().slice(0, 10);
export const exporterArrivees = (filtres: ArriveeFiltres) =>
  telecharger(`/courrier/arrivees/export.xlsx${query(filtres)}`, `courrier_arrivee_${jour()}.xlsx`);
export const exporterActes = (filtres: ActeFiltres) =>
  telecharger(`/courrier/actes/export.xlsx${query(filtres)}`, `departs_actes_${jour()}.xlsx`);
