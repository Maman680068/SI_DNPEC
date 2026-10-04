'use client';

import { useState } from 'react';
import { createDocument } from '../../lib/api/documents';
import type { DnpecDocument, DocumentCategory, TypeDocument } from '../../lib/documents/types';
import { CATEGORY_LABEL, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, ZoneDepot, ZoneTexte } from '../ui/Formulaire';
import { useToast } from '../ui/Toast';
import { jourLocal, useEnvoi } from '../courrier/formulaire';

/** Dépôt d'un document (GED). Métadonnées obligatoires (socle N4) : type, date, période couverte.
 * `source` : dépôt direct depuis une tâche ou une réunion (lien vers l'objet d'origine). */
export function UploadDocumentModal({
  divisionId,
  celluleId,
  folderId,
  onClose,
  onCreated,
  source,
  fichierInitial,
  dossierLibelle,
}: {
  /** Unité productrice : une division OU une cellule. */
  divisionId?: string | null;
  celluleId?: string | null;
  folderId: string | null;
  onClose: () => void;
  onCreated: (doc: DnpecDocument) => void;
  source?: { tacheId?: string; reunionId?: string; libelle: string; type?: TypeDocument; periodeDebut?: string; periodeFin?: string };
  /** Fichier déposé par glisser-déposer sur la liste : le formulaire s'ouvre avec lui (titre proposé). */
  fichierInitial?: File | null;
  /** Dossier de destination, rappelé sous le titre du formulaire. */
  dossierLibelle?: string | null;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(fichierInitial ? fichierInitial.name.replace(/\.[^.]+$/, '') : '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('AUTRE');
  const [typeDocument, setTypeDocument] = useState<TypeDocument | ''>(source?.type ?? '');
  const [dateDocument, setDateDocument] = useState(jourLocal(0));
  const [periodeDebut, setPeriodeDebut] = useState(source?.periodeDebut ?? '');
  const [periodeFin, setPeriodeFin] = useState(source?.periodeFin ?? '');
  const [fichiers, setFichiers] = useState<File[]>(fichierInitial ? [fichierInitial] : []);
  const { enCours, erreur, envoyer } = useEnvoi();

  return (
    <FenetreFormulaire
      titre="Déposer un document"
      sousTitre={source ? <span data-testid="source-depot">Issu de : {source.libelle}</span> : dossierLibelle ? `Dans « ${dossierLibelle} »` : undefined}
      libelleValider="Déposer le document"
      testid="fenetre-depot"
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Le document est déposé au statut « Brouillon », visible de votre unité seulement."
      valider={() => (periodeDebut && periodeFin && periodeFin < periodeDebut ? { 'doc-fin': 'La fin de la période ne peut pas précéder son début.' } : {})}
      onSubmit={async () => {
        const fichier = fichiers[0]!;
        const r = await envoyer(() =>
          createDocument({
            title: title.trim(),
            description: description.trim() || undefined,
            category,
            divisionId: divisionId ?? undefined,
            celluleId: celluleId ?? undefined,
            folderId: folderId ?? undefined,
            typeDocument: typeDocument as TypeDocument,
            dateDocument,
            periodeDebut,
            periodeFin,
            sourceTaskId: source?.tacheId,
            sourceMeetingId: source?.reunionId,
            file: fichier,
          }),
        );
        if (!r.ok) return;
        toast.succes('Document déposé', { detail: `« ${r.valeur.title} » est en brouillon.` });
        onCreated(r.valeur);
      }}
    >
      <Saisie id="doc-titre" label="Titre" value={title} onChange={setTitle} required maxLength={300} messageObligatoire="Indiquez le titre du document." />
      <ZoneDepot id="doc-fichier" label="Fichier" fichiers={fichiers} onChange={setFichiers} required />
      <Grille2>
        <Liste
          id="doc-type"
          label="Type"
          value={typeDocument}
          onChange={(v) => setTypeDocument(v as TypeDocument)}
          vide="Choisir…"
          options={(Object.keys(TYPE_DOCUMENT_LABEL) as TypeDocument[]).map((t) => ({ value: t, label: TYPE_DOCUMENT_LABEL[t] }))}
          required
          messageObligatoire="Choisissez le type du document."
        />
        <ChampDate id="doc-date" label="Date du document" value={dateDocument} onChange={setDateDocument} required messageObligatoire="Indiquez la date du document." />
        <ChampDate id="doc-debut" label="Période couverte : du" value={periodeDebut} onChange={setPeriodeDebut} required messageObligatoire="Indiquez le début de la période couverte." />
        <ChampDate id="doc-fin" label="Au" value={periodeFin} onChange={setPeriodeFin} min={periodeDebut || undefined} required messageObligatoire="Indiquez la fin de la période couverte." />
      </Grille2>
      <ChoixSegment<DocumentCategory>
        id="doc-categorie"
        label="Classement"
        value={category}
        onChange={setCategory}
        options={(Object.keys(CATEGORY_LABEL) as DocumentCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />
      <ZoneTexte id="doc-description" label="Description" facultatif value={description} onChange={setDescription} lignes={2} />
    </FenetreFormulaire>
  );
}
