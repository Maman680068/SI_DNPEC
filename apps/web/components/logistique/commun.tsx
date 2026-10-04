'use client';

import { useState, type ReactNode } from 'react';
import { Libelle, messageErreur } from '../courrier/ui';
import { FenetreDetail } from '../ui/FenetreDetail';

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

/** Choix de vue segmenté (maquette : `.seg`) : boutons à bascule, la vue active en bleu nuit. */
export function SousOnglets<K extends string>({ valeur, options, onChange, label = 'Vue' }: { valeur: K; options: { cle: K; libelle: string }[]; onChange: (k: K) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full flex-wrap gap-0.5 rounded-[9px] border border-line bg-surface p-[3px]">
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          aria-pressed={valeur === o.cle}
          onClick={() => onChange(o.cle)}
          className={`flex h-7 items-center rounded-[6px] px-[11px] text-[13px] font-semibold ${valeur === o.cle ? 'bg-ink text-white' : 'text-text-muted hover:text-ink'}`}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

export function Info({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-3.5 rounded-[10px] border border-[#A9D5B7] bg-sage-50 px-3.5 py-2.5 text-[13.5px] text-sage">
      {message}
    </div>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-[13.5px] text-text-muted">{children}</p>;
}

/**
 * Fiche en lecture avec ses actions : fenêtre centrée de la charte (`FenetreDetail`), plein écran sur
 * téléphone. `cote` : colonne de droite (actions puis informations) quand la fiche en a une.
 */
export function Panneau({ titre, sousTitre, onClose, children, testid, cote, filAriane }: { titre: string; sousTitre?: ReactNode; onClose: () => void; children: ReactNode; testid?: string; cote?: ReactNode; filAriane?: string[] }) {
  return (
    <FenetreDetail
      titre={titre}
      onClose={onClose}
      testid={testid}
      filAriane={filAriane ?? ['Logistique']}
      largeur={cote ? 960 : 720}
      cote={cote}
      entete={sousTitre ? <div className="mt-1.5 text-[13px] text-text-muted">{sousTitre}</div> : undefined}
    >
      {children}
    </FenetreDetail>
  );
}
