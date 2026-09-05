'use client';

import { useState, type FormEvent } from 'react';
import { createDocument } from '../../lib/api/documents';
import type { DnpecDocument, DocumentCategory } from '../../lib/documents/types';
import { CATEGORY_LABEL } from '../../lib/documents/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function UploadDocumentModal({
  divisionId,
  folderId,
  onClose,
  onCreated,
}: {
  divisionId: string;
  folderId: string | null;
  onClose: () => void;
  onCreated: (doc: DnpecDocument) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('AUTRE');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const doc = await createDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        divisionId,
        folderId: folderId ?? undefined,
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
        className="w-full max-w-[440px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Nouveau document</h2>

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

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Catégorie</label>
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
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Fichier</label>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-[13px]"
          />
        </div>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !title.trim() || !file}>
            {submitting ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
