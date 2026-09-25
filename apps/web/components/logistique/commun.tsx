'use client';

import { useState, type ReactNode } from 'react';
import { Libelle, messageErreur } from '../courrier/ui';

export const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
export const nom = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}` : '');

/** Exécute une action ; le refus de l'API est affiché tel quel. */
export function useAction() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function lancer<T>(fn: () => Promise<T>, defaut: string): Promise<T | undefined> {
    setEnCours(true);
    setErreur(null);
    try {
      return await fn();
    } catch (e) {
      setErreur(messageErreur(e, defaut));
      return undefined;
    } finally {
      setEnCours(false);
    }
  }
  return { enCours, erreur, setErreur, lancer };
}

export function Champ({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="mb-3.5">
      <Libelle htmlFor={id}>{label}</Libelle>
      {children}
    </div>
  );
}

export function SousOnglets<K extends string>({ valeur, options, onChange }: { valeur: K; options: { cle: K; libelle: string }[]; onChange: (k: K) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          onClick={() => onChange(o.cle)}
          className={`rounded-[6px] px-3 py-1.5 text-[12.5px] font-semibold ${valeur === o.cle ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

export function Info({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="mb-4 rounded-md bg-sage-soft px-3.5 py-3 text-[13px] text-sage">{message}</div>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-text-faint">{children}</p>;
}

/** Fiche en lecture avec ses actions (pas de formulaire) : plein écran utile sur mobile. */
export function Panneau({ titre, sousTitre, onClose, children, testid }: { titre: string; sousTitre?: ReactNode; onClose: () => void; children: ReactNode; testid?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,38,0.42)] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={titre}
        data-testid={testid}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-surface p-5 sm:max-w-[620px] sm:rounded-lg sm:p-6"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold">{titre}</h2>
            {sousTitre && <div className="mt-1 text-[12.5px] text-text-muted">{sousTitre}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-[18px] leading-none text-text-muted hover:text-ink">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
