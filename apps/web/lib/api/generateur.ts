import { API_BASE_URL, ApiError, apiFetch, appelApi, authHeaders } from './client';
import type { AttestationTravail, Catalogue, Demande, OrdreMission } from '../generateur/types';

const j = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export const getCatalogue = () => apiFetch<Catalogue>('/api/v1/documents-generes/catalogue');
export const getAttestations = () => apiFetch<AttestationTravail[]>('/api/v1/attestations-travail');
export const creerAttestation = (agentId: string) => apiFetch<AttestationTravail>('/api/v1/attestations-travail', j({ agentId }));
export const acteAttestation = (id: string, registreId: string) => apiFetch<{ acteId: string }>(`/api/v1/attestations-travail/${id}/acte`, j({ registreId }));
export const getOrdres = () => apiFetch<OrdreMission[]>('/api/v1/ordres-mission');
export const creerOrdre = (input: { agentId: string; objet: string; destination: string; dateDepart: string; dateRetour: string; transport?: string; fraisMontant?: number }) =>
  apiFetch<OrdreMission>('/api/v1/ordres-mission', j(input));
export const acteOrdre = (id: string, registreId: string) => apiFetch<{ acteId: string }>(`/api/v1/ordres-mission/${id}/acte`, j({ registreId }));
export const deposerEnGed = (d: Demande) => apiFetch<{ documentId: string }>('/api/v1/documents-generes/ged', j(d));
export const transmettre = (d: Demande, destinataireId: string, message?: string) =>
  apiFetch<{ transmis: boolean }>('/api/v1/documents-generes/transmettre', j({ ...d, destinataireId, ...(message ? { message } : {}) }));

/** Fichier produit par l'API (réponse binaire) : erreurs lues comme apiFetch, en français. */
async function produire(path: string, d: Demande): Promise<{ blob: Blob; fileName: string }> {
  const res = await appelApi(`${API_BASE_URL}${path}`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  if (!res.ok) {
    let message = 'Production du document impossible';
    try {
      const b = (await res.json()) as { message?: string | string[] };
      if (b.message) message = Array.isArray(b.message) ? b.message.join(', ') : b.message;
    } catch {
      // corps non JSON
    }
    throw new ApiError(res.status, message);
  }
  const annonce = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1];
  return { blob: await res.blob(), fileName: annonce ? decodeURIComponent(annonce) : 'document' };
}

/** Aperçu fidèle : le PDF qui sera imprimé (URL d'objet à révoquer par l'appelant). */
export async function apercu(d: Demande): Promise<string> {
  const { blob } = await produire('/api/v1/documents-generes/apercu', { ...d, format: 'PDF' });
  return URL.createObjectURL(blob);
}

export async function telecharger(d: Demande, format: 'PDF' | 'DOCX'): Promise<void> {
  const { blob, fileName } = await produire('/api/v1/documents-generes/telecharger', { ...d, format });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
