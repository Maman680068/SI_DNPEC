import { apiFetch, telechargerFichier } from './client';
import type { Capacites, Candidat, FormatEvaluation, ListeStages, ModeleAttestation, PeriodeInput, Planning, Stage } from '../stages/types';

const j = (body: unknown) => ({ body: JSON.stringify(body) });

export const getStages = () => apiFetch<ListeStages>('/stages');
export const getStage = (id: string) => apiFetch<Stage>(`/stages/${id}`);
export const getStagiairesDisponibles = () => apiFetch<Candidat[]>('/stages/stagiaires-disponibles');
export const getPlanning = (debut?: string, fin?: string) =>
  apiFetch<Planning>(`/stages/planning${debut ? `?debut=${debut}${fin ? `&fin=${fin}` : ''}` : ''}`);
export const getCapacites = () => apiFetch<Capacites>('/stages/capacites');
export const fixerCapacite = (uniteKey: string, maximum: number | null) => apiFetch('/stages/capacites', { method: 'PUT', ...j({ uniteKey, maximum }) });

export const creerStage = (input: { stagiaireId: string; etablissement: string; diplomePrepare?: string; encadrantAcademique?: string; dateDebut: string; dateFin: string }) =>
  apiFetch<Stage>('/stages', { method: 'POST', ...j(input) });
export const modifierStage = (id: string, input: Partial<{ etablissement: string; diplomePrepare: string; encadrantAcademique: string; dateDebut: string; dateFin: string }>) =>
  apiFetch<Stage>(`/stages/${id}`, { method: 'PATCH', ...j(input) });
export const cloturerStage = (id: string) => apiFetch<Stage>(`/stages/${id}/cloturer`, { method: 'POST' });
export const interrompreStage = (id: string, motif: string) => apiFetch<Stage>(`/stages/${id}/interrompre`, { method: 'POST', ...j({ motif }) });

export const ajouterPeriode = (id: string, input: PeriodeInput) => apiFetch<Stage>(`/stages/${id}/periodes`, { method: 'POST', ...j(input) });
export const modifierPeriode = (id: string, pid: string, input: Partial<PeriodeInput>) => apiFetch<Stage>(`/stages/${id}/periodes/${pid}`, { method: 'PATCH', ...j(input) });
export const retirerPeriode = (id: string, pid: string) => apiFetch<Stage>(`/stages/${id}/periodes/${pid}`, { method: 'DELETE' });
export const getTuteursPossibles = (id: string, pid: string) => apiFetch<Candidat[]>(`/stages/${id}/periodes/${pid}/tuteurs-possibles`);
export const accepterPeriode = (id: string, pid: string, tuteurId: string) => apiFetch<Stage>(`/stages/${id}/periodes/${pid}/accepter`, { method: 'POST', ...j({ tuteurId }) });
export const refuserPeriode = (id: string, pid: string, motif: string) => apiFetch<Stage>(`/stages/${id}/periodes/${pid}/refuser`, { method: 'POST', ...j({ motif }) });
export const changerTuteur = (id: string, pid: string, tuteurId: string) => apiFetch<Stage>(`/stages/${id}/periodes/${pid}/tuteur`, { method: 'POST', ...j({ tuteurId }) });
export const changerFormat = (id: string, pid: string, formatEvaluation: FormatEvaluation) =>
  apiFetch<Stage>(`/stages/${id}/periodes/${pid}/format`, { method: 'POST', ...j({ formatEvaluation }) });

export const enregistrerEvaluation = (id: string, pid: string, input: { criteres?: Record<string, string>; appreciation?: string }) =>
  apiFetch<Stage>(`/stages/${id}/periodes/${pid}/evaluation`, { method: 'PUT', ...j(input) });
export const soumettreEvaluation = (id: string, pid: string) => apiFetch<Stage>(`/stages/${id}/periodes/${pid}/evaluation/soumettre`, { method: 'POST' });
export const viserEvaluation = (id: string, pid: string) => apiFetch<Stage>(`/stages/${id}/periodes/${pid}/evaluation/viser`, { method: 'POST' });
export const renvoyerEvaluation = (id: string, pid: string, motif: string) =>
  apiFetch<Stage>(`/stages/${id}/periodes/${pid}/evaluation/renvoyer`, { method: 'POST', ...j({ motif }) });

export const getModeleAttestation = () => apiFetch<ModeleAttestation>('/stages/modele-attestation');
export function importerModeleAttestation(fichier: File) {
  const fd = new FormData();
  fd.append('file', fichier);
  return apiFetch<ModeleAttestation>('/stages/modele-attestation', { method: 'POST', body: fd });
}
export const getRegistresAttestation = () => apiFetch<{ id: string; code: string; libelle: string }[]>('/stages/registres-attestation');
export const creerActeAttestation = (id: string, registreId: string) => apiFetch<{ acteId: string }>(`/stages/${id}/attestation/acte`, { method: 'POST', ...j({ registreId }) });
export const prendreConnaissanceAttestation = (id: string) => apiFetch<Stage>(`/stages/${id}/attestation/prise-de-connaissance`, { method: 'POST' });

export const telechargerModele = () => telechargerFichier('/stages/modele-attestation/fichier', null);
export const telechargerProvisoire = (id: string) => telechargerFichier(`/stages/${id}/attestation/provisoire`, 'attestation-provisoire.pdf');
export const telechargerDocument = (id: string) => telechargerFichier(`/stages/${id}/attestation/document`, null);
export const telechargerFinale = (id: string) => telechargerFichier(`/stages/${id}/attestation/finale`, 'attestation-signee.pdf');
