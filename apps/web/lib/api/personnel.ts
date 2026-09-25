import { apiFetch, telechargerFichier } from './client';
import type { Diplome, DossierPersonnel, ListePersonnel, NiveauDeux, NiveauUn, PieceAdministrative, RapportImport } from '../personnel/types';

export function getListePersonnel(): Promise<ListePersonnel> {
  return apiFetch<ListePersonnel>('/personnel-files');
}

export function getDossier(userId: string): Promise<DossierPersonnel> {
  return apiFetch<DossierPersonnel>(`/personnel-files/${userId}`);
}

export type NiveauUnInput = Partial<Pick<NiveauUn, 'employmentStatus' | 'grade' | 'echelon' | 'serviceStartDate'>>;

export function modifierNiveauUn(userId: string, input: NiveauUnInput): Promise<unknown> {
  return apiFetch(`/personnel-files/${userId}/basic`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function modifierNiveauDeux(userId: string, input: Partial<NiveauDeux>): Promise<unknown> {
  return apiFetch(`/personnel-files/${userId}/sensitive`, { method: 'PATCH', body: JSON.stringify(input) });
}

function formulaire(fichier: File | null, champs: Record<string, string | number | undefined> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) if (v !== undefined && v !== '') fd.append(k, String(v));
  if (fichier) fd.append('file', fichier);
  return fd;
}

export function deposerFicheDePoste(userId: string, fichier: File): Promise<unknown> {
  return apiFetch(`/personnel-files/${userId}/job-description`, { method: 'POST', body: formulaire(fichier) });
}

export function ajouterDiplome(
  userId: string,
  input: { title: string; institution?: string; obtainedYear?: number },
  fichier: File | null,
): Promise<Diplome> {
  return apiFetch<Diplome>(`/personnel-files/${userId}/diplomas`, { method: 'POST', body: formulaire(fichier, input) });
}

export function supprimerDiplome(userId: string, diplomaId: string): Promise<unknown> {
  return apiFetch(`/personnel-files/${userId}/diplomas/${diplomaId}`, { method: 'DELETE' });
}

export function ajouterPiece(userId: string, label: string, fichier: File): Promise<PieceAdministrative> {
  return apiFetch<PieceAdministrative>(`/personnel-files/${userId}/documents`, { method: 'POST', body: formulaire(fichier, { label }) });
}

export function supprimerPiece(userId: string, documentId: string): Promise<unknown> {
  return apiFetch(`/personnel-files/${userId}/documents/${documentId}`, { method: 'DELETE' });
}

export function confirmerMesInformations(userId: string): Promise<unknown> {
  return apiFetch(`/personnel-files/${userId}/confirm`, { method: 'POST' });
}

export function signalerErreur(userId: string, fieldLabel: string, comment: string): Promise<unknown> {
  return apiFetch(`/personnel-files/${userId}/report-error`, { method: 'POST', body: JSON.stringify({ fieldLabel, comment }) });
}

export function importerPersonnel(fichier: File): Promise<RapportImport> {
  return apiFetch<RapportImport>('/personnel-files/import', { method: 'POST', body: formulaire(fichier) });
}

export const telechargerFicheDePoste = (userId: string, fileName: string) =>
  telechargerFichier(`/personnel-files/${userId}/job-description`, fileName);
export const telechargerDiplome = (userId: string, diplomaId: string, fileName: string) =>
  telechargerFichier(`/personnel-files/${userId}/diplomas/${diplomaId}/download`, fileName);
export const telechargerPiece = (userId: string, documentId: string, fileName: string) =>
  telechargerFichier(`/personnel-files/${userId}/documents/${documentId}/download`, fileName);
