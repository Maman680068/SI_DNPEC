'use client';

import { useState } from 'react';
import type { Registre } from '../../lib/courrier/types';
import { SELECT_CLASS } from './ui';

export interface FiltresValeur {
  annee?: number;
  registreId?: string;
  statut?: string;
  q?: string;
}

/** Filtres d'un registre. Sans année : la vue courante (année en cours et tout
 * ce qui est encore en cours) ; avec une année : exactement cette année. */
export function Filtres({
  valeur,
  onChange,
  registres,
  statuts,
}: {
  valeur: FiltresValeur;
  onChange: (v: FiltresValeur) => void;
  registres: Registre[];
  statuts: Record<string, string>;
}) {
  const [q, setQ] = useState(valeur.q ?? '');
  const annee = new Date().getFullYear();
  const annees = Array.from({ length: 6 }, (_, i) => annee - i);
  const cls = `${SELECT_CLASS} !py-2 text-[13px]`;
  return (
    <form
      className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ ...valeur, q: q.trim() || undefined });
      }}
    >
      <select aria-label="Année" className={cls} value={valeur.annee ?? ''} onChange={(e) => onChange({ ...valeur, annee: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">Vue courante</option>
        {annees.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select aria-label="Registre" className={cls} value={valeur.registreId ?? ''} onChange={(e) => onChange({ ...valeur, registreId: e.target.value || undefined })}>
        <option value="">Tous les registres</option>
        {registres.map((r) => (
          <option key={r.id} value={r.id}>
            {r.code} — {r.libelle}
            {r.isActive ? '' : ' (désactivé)'}
          </option>
        ))}
      </select>
      <select aria-label="Statut" className={cls} value={valeur.statut ?? ''} onChange={(e) => onChange({ ...valeur, statut: e.target.value || undefined })}>
        <option value="">Tous les statuts</option>
        {Object.entries(statuts).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input
        aria-label="Rechercher"
        type="search"
        placeholder="Numéro, objet, expéditeur… (Entrée)"
        className={cls}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => (q.trim() || undefined) !== valeur.q && onChange({ ...valeur, q: q.trim() || undefined })}
      />
    </form>
  );
}
