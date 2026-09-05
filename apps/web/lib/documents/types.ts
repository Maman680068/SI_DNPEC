export type DocumentCategory = 'ETUDE' | 'RAPPORT' | 'NOTE_TECHNIQUE' | 'AUTRE';
export type DocumentVisibility = 'PRIVE_DIVISION' | 'PUBLIE_DNPEC';

export interface Folder {
  id: string;
  divisionId: string;
  parentFolderId: string | null;
  name: string;
  createdById: string;
  createdAt: string;
}

export interface DocumentVersionSummary {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedById: string;
}

export interface DnpecDocument {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  isFinal: boolean;
  divisionId: string;
  folderId: string | null;
  sourceTaskId: string | null;
  currentVersionId: string | null;
  currentVersion: DocumentVersionSummary | null;
  publishedAt: string | null;
  publishedById: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFilters {
  divisionId?: string;
  category?: DocumentCategory;
  visibility?: DocumentVisibility;
  folderId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  ETUDE: 'Étude',
  RAPPORT: 'Rapport',
  NOTE_TECHNIQUE: 'Note technique',
  AUTRE: 'Autre',
};

/** Rôles pouvant créer un dossier/document dans leur propre division uniquement
 * (tout le monde) — la publication institutionnelle, elle, est plus restreinte,
 * voir CAN_PUBLISH_ROLES ci-dessous. */
export const CAN_PUBLISH_ROLES = ['DN', 'DNA', 'CHEF_DIVISION'];
