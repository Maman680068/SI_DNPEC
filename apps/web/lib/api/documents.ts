import { apiFetch, telechargerFichier } from './client';
import type { ChangementStatut, DnpecDocument, DocumentFilters, DocumentVersionSummary, Folder, StatutDiffusion, TypeDocument } from '../documents/types';

export function getFolders(divisionId: string): Promise<Folder[]> {
  return apiFetch<Folder[]>(`/folders?divisionId=${encodeURIComponent(divisionId)}`);
}

export function createFolder(input: { name: string; divisionId: string; parentFolderId?: string }): Promise<Folder> {
  return apiFetch<Folder>('/folders', { method: 'POST', body: JSON.stringify(input) });
}

function buildQuery(filters: DocumentFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function getDocuments(filters: DocumentFilters): Promise<DnpecDocument[]> {
  return apiFetch<DnpecDocument[]>(`/documents${buildQuery(filters)}`);
}

export function getDocument(id: string): Promise<DnpecDocument> {
  return apiFetch<DnpecDocument>(`/documents/${id}`);
}

export interface CreateDocumentInput {
  title: string;
  description?: string;
  category?: string;
  divisionId: string;
  folderId?: string;
  typeDocument: TypeDocument;
  dateDocument?: string;
  periodeDebut: string;
  periodeFin: string;
  sourceTaskId?: string;
  sourceMeetingId?: string;
  file: File;
}

export function createDocument(input: CreateDocumentInput): Promise<DnpecDocument> {
  const form = new FormData();
  form.set('title', input.title);
  if (input.description) form.set('description', input.description);
  if (input.category) form.set('category', input.category);
  form.set('divisionId', input.divisionId);
  if (input.folderId) form.set('folderId', input.folderId);
  form.set('typeDocument', input.typeDocument);
  if (input.dateDocument) form.set('dateDocument', input.dateDocument);
  form.set('periodeDebut', input.periodeDebut);
  form.set('periodeFin', input.periodeFin);
  if (input.sourceTaskId) form.set('sourceTaskId', input.sourceTaskId);
  if (input.sourceMeetingId) form.set('sourceMeetingId', input.sourceMeetingId);
  form.set('file', input.file);
  return apiFetch<DnpecDocument>('/documents', { method: 'POST', body: form });
}

export function getVersions(documentId: string): Promise<DocumentVersionSummary[]> {
  return apiFetch<DocumentVersionSummary[]>(`/documents/${documentId}/versions`);
}

export function addVersion(documentId: string, file: File): Promise<DnpecDocument> {
  const form = new FormData();
  form.set('file', file);
  return apiFetch<DnpecDocument>(`/documents/${documentId}/versions`, { method: 'POST', body: form });
}

export function markFinal(documentId: string): Promise<DnpecDocument> {
  return apiFetch<DnpecDocument>(`/documents/${documentId}/mark-final`, { method: 'POST' });
}

export function publishDocument(documentId: string): Promise<DnpecDocument> {
  return apiFetch<DnpecDocument>(`/documents/${documentId}/publish`, { method: 'POST' });
}

/** Métadonnées (compléter celles d'un document d'avant N4). */
export function updateDocument(documentId: string, input: { typeDocument?: TypeDocument; dateDocument?: string; periodeDebut?: string; periodeFin?: string }): Promise<DnpecDocument> {
  return apiFetch<DnpecDocument>(`/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** Statut de diffusion : valider, rendre diffusable, retirer (motif). */
export function changerStatut(documentId: string, vers: StatutDiffusion, motif?: string): Promise<DnpecDocument> {
  return apiFetch<DnpecDocument>(`/documents/${documentId}/statut`, { method: 'POST', body: JSON.stringify({ vers, ...(motif ? { motif } : {}) }) });
}

export function getHistoriqueStatut(documentId: string): Promise<ChangementStatut[]> {
  return apiFetch<ChangementStatut[]>(`/documents/${documentId}/statut`);
}

/** Copie marquée du statut de diffusion : le nom du fichier est celui annoncé par le serveur. */
export function downloadVersion(documentId: string, versionId: string): Promise<void> {
  return telechargerFichier(`/documents/${documentId}/versions/${versionId}/download`, null);
}
