'use client';

import type { FormEvent, ReactNode } from 'react';
import { useInterim } from '../../lib/interim/InterimProvider';
import { Button } from '../ui/Button';

export const SELECT_CLASS =
  'w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent';
export const TEXTAREA_CLASS = `${SELECT_CLASS} min-h-[88px]`;

export function Libelle({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold text-text">
      {children}
    </label>
  );
}

export function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded-md bg-clay-soft px-3.5 py-3 text-[13px] text-clay">
      {message}
    </div>
  );
}

/** « Sera enregistré par vous, au nom de X » — sur chaque confirmation pendant
 * un intérim : personne n'agit au nom d'un autre sans le voir au moment d'agir. */
export function MentionInterim() {
  const { interim } = useInterim();
  if (!interim) return null;
  return (
    <p className="mb-4 rounded-md border border-gold bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink">
      Sera enregistré par vous, <strong>au nom de {interim.titulaireName}</strong> (par intérim).
    </p>
  );
}

/** Fenêtre modale : plein écran utile sur mobile, 480 px au-delà. */
export function Fenetre({
  titre,
  sousTitre,
  onClose,
  onSubmit,
  children,
  valider,
  enCours,
  danger,
  large,
}: {
  titre: string;
  sousTitre?: ReactNode;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  children?: ReactNode;
  valider: string;
  enCours?: boolean;
  danger?: boolean;
  large?: boolean;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    void onSubmit();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,38,0.42)] sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-surface p-5 sm:rounded-lg sm:p-6 ${large ? 'sm:max-w-[620px]' : 'sm:max-w-[480px]'}`}
      >
        <h2 className="mb-1.5 text-[18px] font-semibold">{titre}</h2>
        {sousTitre && <div className="mb-4 text-[12.5px] text-text-muted">{sousTitre}</div>}
        {children}
        <MentionInterim />
        <div className="mt-2 flex flex-wrap justify-end gap-2.5">
          <Button type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant={danger ? 'solid' : 'gold'} disabled={enCours} className={danger ? '!border-clay !bg-clay' : ''}>
            {enCours ? 'Enregistrement…' : valider}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function messageErreur(err: unknown, defaut: string): string {
  return err instanceof Error && err.message ? err.message : defaut;
}
