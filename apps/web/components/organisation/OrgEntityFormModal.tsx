'use client';

import { useState, type FormEvent } from 'react';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

/** Formulaire générique code+nom, partagé entre Division/Section/Cellule (création et
 * modification) — les trois ont exactement la même forme côté API (CreateDivisionDto,
 * CreateSectionDto, CreateCelluleDto). Le code est toujours mis en majuscules avant
 * envoi : la convention observée partout (DPE, SSR, CSID…), même si seule la longueur
 * est validée côté API pour les sections. */
export function OrgEntityFormModal({
  title,
  codeHint,
  initialCode = '',
  initialName = '',
  onClose,
  onSubmit,
}: {
  title: string;
  codeHint: string;
  initialCode?: string;
  initialName?: string;
  onClose: () => void;
  onSubmit: (code: string, name: string) => Promise<void>;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(code.trim().toUpperCase(), name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">{title}</h2>

        <Field label="Code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={10} />
        <p className="-mt-3 mb-4 text-[11.5px] text-text-faint">{codeHint}</p>
        <Field label="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
