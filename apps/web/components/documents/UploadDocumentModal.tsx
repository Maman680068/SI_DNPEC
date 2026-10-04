'use client';

import { useState, type FormEvent } from 'react';
import { createDocument } from '../../lib/api/documents';
import type { DnpecDocument, DocumentCategory, TypeDocument } from '../../lib/documents/types';
import { CATEGORY_LABEL, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

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
  const [title, setTitle] = useState(fichierInitial ? fichierInitial.name.replace(/\.[^.]+$/, '') : '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('AUTRE');
  const [typeDocument, setTypeDocument] = useState<TypeDocument | ''>(source?.type ?? '');
  const [dateDocument, setDateDocument] = useState(aujourdhui());
  const [periodeDebut, setPeriodeDebut] = useState(source?.periodeDebut ?? '');
  const [periodeFin, setPeriodeFin] = useState(source?.periodeFin ?? '');
  const [file, setFile] = useState<File | null>(fichierInitial ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !typeDocument) return;
    setSubmitting(true);
    setError(null);
    try {
      const doc = await createDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        divisionId: divisionId ?? undefined,
        celluleId: celluleId ?? undefined,
        folderId: folderId ?? undefined,
        typeDocument,
        dateDocument,
        periodeDebut,
        periodeFin,
        sourceTaskId: source?.tacheId,
        sourceMeetingId: source?.reunionId,
        file,
      });
      onCreated(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-lg bg-surface p-6"
      >
        <h2 className="mb-1 text-[19px] font-semibold">Nouveau document</h2>
        {source ? (
          <p className="mb-4 text-[12.5px] text-text-muted" data-testid="source-depot">
            Issu de : {source.libelle}
          </p>
        ) : dossierLibelle ? (
          <p className="mb-4 text-[12.5px] text-text-muted">Dans « {dossierLibelle} »</p>
        ) : (
          <div className="mb-4" />
        )}

        <Field label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Description (optionnel)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
          />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="doc-type" className="mb-1.5 block text-[12.5px] font-semibold text-text">
              Type
            </label>
            <select
              id="doc-type"
              value={typeDocument}
              onChange={(e) => setTypeDocument(e.target.value as TypeDocument)}
              required
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Choisir…</option>
              {(Object.keys(TYPE_DOCUMENT_LABEL) as TypeDocument[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_DOCUMENT_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="doc-date" className="mb-1.5 block text-[12.5px] font-semibold text-text">
              Date du document
            </label>
            <input id="doc-date" type="date" value={dateDocument} onChange={(e) => setDateDocument(e.target.value)} required className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="doc-debut" className="mb-1.5 block text-[12.5px] font-semibold text-text">
              Période couverte : du
            </label>
            <input id="doc-debut" type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} required className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="doc-fin" className="mb-1.5 block text-[12.5px] font-semibold text-text">
              au
            </label>
            <input id="doc-fin" type="date" value={periodeFin} min={periodeDebut || undefined} onChange={(e) => setPeriodeFin(e.target.value)} required className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Catégorie (classement)</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {(Object.keys(CATEGORY_LABEL) as DocumentCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="doc-fichier" className="mb-1.5 block text-[12.5px] font-semibold text-text">Fichier</label>
          {fichierInitial && file === fichierInitial && (
            <p className="mb-1.5 text-[13px]" data-testid="fichier-depose">
              <span className="font-semibold">{file.name}</span> <span className="text-text-muted">— ou choisissez un autre fichier :</span>
            </p>
          )}
          <input
            id="doc-fichier"
            type="file"
            required={!file}
            onChange={(e) => setFile(e.target.files?.[0] ?? fichierInitial ?? null)}
            className="w-full text-[13px]"
          />
        </div>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !title.trim() || !file || !typeDocument || !periodeDebut || !periodeFin}>
            {submitting ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
