'use client';

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';

/**
 * Fenêtre modale accessible (socle NIMBA) : rôle dialog, titre relié, Échap pour
 * fermer, focus placé dans la fenêtre à l'ouverture. Avec `onSubmit`, le contenu
 * est un formulaire (Entrée valide) ; l'erreur éventuelle s'affiche au-dessus des boutons.
 */
export function Fenetre({
  titre,
  children,
  onClose,
  onSubmit,
  libelleValider = 'Enregistrer',
  enCours = false,
  erreur,
  largeur = 460,
  danger = false,
}: {
  titre: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit?: () => void | Promise<void>;
  libelleValider?: string;
  enCours?: boolean;
  erreur?: string | null;
  largeur?: number;
  danger?: boolean;
}) {
  const idTitre = useId();
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', echap);
    boite.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => window.removeEventListener('keydown', echap);
  }, [onClose]);

  const contenu = (
    <>
      <h2 id={idTitre} className="mb-4 text-[18px] font-semibold">
        {titre}
      </h2>
      {children}
      {erreur && (
        <div role="alert" className="mb-4 mt-2 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">
          {erreur}
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onClose}>
          {onSubmit ? 'Annuler' : 'Fermer'}
        </Button>
        {onSubmit && (
          <Button type="submit" variant="solid" disabled={enCours} className={danger ? '!border-clay !bg-clay' : ''}>
            {enCours ? 'Enregistrement…' : libelleValider}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-lg bg-surface p-6"
        style={{ maxWidth: largeur }}
      >
        {onSubmit ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            {contenu}
          </form>
        ) : (
          contenu
        )}
      </div>
    </div>
  );
}

/** Liste déroulante avec libellé (même style que Field). */
export function Choix({
  label,
  value,
  onChange,
  options,
  required,
  vide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  vide?: string;
}) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-semibold text-text">
        {label}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-text focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
      >
        {vide !== undefined && <option value="">{vide}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Zone de texte avec libellé (motifs). */
export function Texte({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-semibold text-text">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
      />
    </div>
  );
}
