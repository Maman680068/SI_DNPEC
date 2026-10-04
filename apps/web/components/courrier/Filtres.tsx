'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Registre } from '../../lib/courrier/types';
import { BarreOutils, FiltreSelect, Recherche } from '../ui/Charte';

export interface FiltresValeur {
  annee?: number;
  registreId?: string;
  statut?: string;
  q?: string;
}

/**
 * Filtres compacts d'un registre : recherche (numéro, objet, expéditeur), registre, statut,
 * période et, pour les arrivées, « Imputé à » (filtre de la liste chargée, sans appel). Sans
 * année : la vue courante (année en cours et tout ce qui est encore en cours) ; avec une année :
 * exactement cette année.
 */
export function Filtres({
  valeur,
  onChange,
  registres,
  statuts,
  imputes,
  imputeA,
  onImputeA,
  droite,
  placeholder,
}: {
  valeur: FiltresValeur;
  onChange: (v: FiltresValeur) => void;
  registres: Registre[];
  statuts: Record<string, string>;
  /** Personnes imputées dans la liste affichée (arrivées seulement). */
  imputes?: { id: string; nom: string }[];
  imputeA?: string;
  onImputeA?: (id: string) => void;
  droite?: ReactNode;
  placeholder: string;
}) {
  const [q, setQ] = useState(valeur.q ?? '');
  const courant = useRef(valeur);
  courant.current = valeur;
  // Recherche appliquée après une courte pause de frappe (ou Entrée).
  useEffect(() => {
    const v = q.trim() || undefined;
    if (v === courant.current.q) return;
    const t = setTimeout(() => onChange({ ...courant.current, q: v }), 350);
    return () => clearTimeout(t);
  }, [q, onChange]);
  const annee = new Date().getFullYear();
  const annees = Array.from({ length: 6 }, (_, i) => annee - i);
  return (
    <BarreOutils droite={droite}>
      <form
        role="search"
        className="w-full sm:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ ...valeur, q: q.trim() || undefined });
        }}
      >
        <Recherche value={q} onChange={setQ} placeholder={placeholder} label="Rechercher" />
      </form>
      <FiltreSelect
        label="Registre"
        value={valeur.registreId ?? ''}
        defaut=""
        onChange={(v) => onChange({ ...valeur, registreId: v || undefined })}
        options={[{ value: '', label: 'Registre : tous' }, ...registres.map((r) => ({ value: r.id, label: `Registre : ${r.libelle}${r.isActive ? '' : ' (désactivé)'}` }))]}
      />
      <FiltreSelect
        label="Statut"
        value={valeur.statut ?? ''}
        defaut=""
        onChange={(v) => onChange({ ...valeur, statut: v || undefined })}
        options={[{ value: '', label: 'Statut' }, ...Object.entries(statuts).map(([k, v]) => ({ value: k, label: v }))]}
      />
      <FiltreSelect
        label="Période"
        value={valeur.annee ? String(valeur.annee) : ''}
        defaut=""
        onChange={(v) => onChange({ ...valeur, annee: v ? Number(v) : undefined })}
        options={[{ value: '', label: 'Période : vue courante' }, ...annees.map((a) => ({ value: String(a), label: `Année ${a}` }))]}
      />
      {imputes && onImputeA && (
        <FiltreSelect
          label="Imputé à"
          value={imputeA ?? ''}
          defaut=""
          onChange={onImputeA}
          options={[{ value: '', label: 'Imputé à' }, ...imputes.map((p) => ({ value: p.id, label: p.nom }))]}
        />
      )}
    </BarreOutils>
  );
}
