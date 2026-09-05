import { apiFetch, API_BASE_URL, getCurrentAccessToken } from './client';
import type { DnpecDocument, DocumentFilters, DocumentVersionSummary, Folder } from '../documents/types';

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
  file: File;
}

export function createDocument(input: CreateDocumentInput): Promise<DnpecDocument> {
  const form = new FormData();
  form.set('title', input.title);
  if (input.description) form.set('description', input.description);
  if (input.category) form.set('category', input.category);
  form.set('divisionId', input.divisionId);
  if (input.folderId) form.set('folderId', input.folderId);
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

/** Hors apiFetch : la réponse est un flux binaire, pas du JSON — déclenche un
 * téléchargement navigateur via une URL d'objet temporaire. */
export async function downloadVersion(documentId: string, versionId: string, fileName: string): Promise<void> {
  const token = getCurrentAccessToken();
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}/versions/${versionId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Téléchargement impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
