export type DocumentCategory = 'ETUDE' | 'RAPPORT' | 'NOTE_TECHNIQUE' | 'AUTRE';
export type DocumentVisibility = 'PRIVE_DIVISION' | 'PUBLIE_DNPEC';
export type StatutDiffusion = 'BROUILLON' | 'VALIDE' | 'DIFFUSABLE';
export type TypeDocument = 'ETUDE' | 'RAPPORT' | 'NOTE_TECHNIQUE' | 'PROCES_VERBAL' | 'ACTE' | 'RPEF' | 'NOTE_CONJONCTURE' | 'AUTRE';

/** Statut de diffusion (socle N4, §7.1). */
export const STATUT_LABEL: Record<StatutDiffusion, string> = { BROUILLON: 'Brouillon', VALIDE: 'Validé', DIFFUSABLE: 'Diffusable' };
export const STATUT_TON: Record<StatutDiffusion, 'muted' | 'accent' | 'sage'> = { BROUILLON: 'muted', VALIDE: 'accent', DIFFUSABLE: 'sage' };

export const TYPE_DOCUMENT_LABEL: Record<TypeDocument, string> = {
  ETUDE: 'Étude',
  RAPPORT: 'Rapport',
  NOTE_TECHNIQUE: 'Note technique',
  PROCES_VERBAL: 'Procès-verbal',
  ACTE: 'Acte',
  RPEF: 'RPEF',
  NOTE_CONJONCTURE: 'Note de conjoncture',
  AUTRE: 'Autre',
};

/** Objet d'origine d'un document (tâche ou réunion) ; titre nul si le lecteur ne le voit pas. */
export interface SourceDocument {
  type: 'TACHE' | 'REUNION';
  id: string;
  titre: string | null;
}

export interface ChangementStatut {
  id: string;
  de: StatutDiffusion | null;
  vers: StatutDiffusion;
  motif: string | null;
  le: string;
  par: string | null;
}

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
  /** Unité productrice : une division OU une cellule rattachée à la Direction. */
  divisionId: string | null;
  celluleId: string | null;
  folderId: string | null;
  sourceTaskId: string | null;
  sourceMeetingId: string | null;
  statutDiffusion: StatutDiffusion;
  typeDocument: TypeDocument;
  dateDocument: string;
  periodeDebut: string | null;
  periodeFin: string | null;
  metadonneesCompletes: boolean;
  source: SourceDocument | null;
  droits: { modifier: boolean; marquerFinal: boolean; publier: boolean; valider: boolean; rendreDiffusable: boolean; retirer: boolean };
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
  celluleId?: string;
  category?: DocumentCategory;
  visibility?: DocumentVisibility;
  folderId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Période couverte qui chevauche [couvreDu, couvreAu] (AAAA-MM-JJ). */
  couvreDu?: string;
  couvreAu?: string;
  q?: string;
  typeDocument?: TypeDocument;
  statutDiffusion?: StatutDiffusion;
  sourceTaskId?: string;
  sourceMeetingId?: string;
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

/** Ton de la pastille de statut (charte : Brouillon gris, Validé bleu, Diffusable vert). */
export const STATUT_PASTILLE: Record<StatutDiffusion, 'gris' | 'bleu' | 'vert'> = { BROUILLON: 'gris', VALIDE: 'bleu', DIFFUSABLE: 'vert' };

/** Synthèse de l'écran « Archives & documents » (api/v1/documents/synthese). */
export interface SyntheseArchives {
  /** Documents qui attendent la validation de l'acteur (Final, métadonnées complètes). */
  aValider: { id: string; titre: string; divisionId: string | null; celluleId: string | null; marqueFinalPar: string | null }[];
  /** Documents publiés pour toute la DNPEC. */
  publies: number;
}
