'use client';

import { useId, type ReactNode } from 'react';
import { FenetreFormulaire, MessageErreurChamp, useSaisie } from './Formulaire';

/**
 * Fenêtre modale des petits formulaires (motifs, confirmations…) : même modèle que les grands
 * formulaires (refonte, étape 9, `FenetreFormulaire`) — titre et croix, validation des champs dans la
 * fenêtre, phrase d'explication et bouton principal à droite en pied. Échap ferme la fenêtre.
 */
export function Fenetre({
  titre,
  children,
  onClose,
  onSubmit,
  libelleValider = 'Enregistrer',
  enCours = false,
  erreur,
  largeur = 520,
  danger = false,
  pied,
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
  pied?: ReactNode;
}) {
  return (
    <FenetreFormulaire titre={titre} onClose={onClose} onSubmit={onSubmit} libelleValider={libelleValider} enCours={enCours} erreur={erreur} largeur={largeur} danger={danger} pied={pied}>
      {children}
    </FenetreFormulaire>
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
  const a = useSaisie(id);
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text">
        {label}
      </label>
      <select id={id} value={value} required={required} onChange={(e) => { onChange(e.target.value); a.onInput(); }} aria-invalid={a['aria-invalid']} aria-describedby={a['aria-describedby']} className={`${a.className} h-10`}>
        {vide !== undefined && <option value="">{vide}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <MessageErreurChamp id={id} />
    </div>
  );
}

/** Zone de texte avec libellé (motifs). */
export function Texte({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  const id = useId();
  const a = useSaisie(id);
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        onInput={a.onInput}
        aria-invalid={a['aria-invalid']}
        aria-describedby={a['aria-describedby']}
        className={`${a.className} py-2.5`}
      />
      <MessageErreurChamp id={id} />
    </div>
  );
}
