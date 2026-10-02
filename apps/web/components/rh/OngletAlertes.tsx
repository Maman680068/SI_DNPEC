'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAlertesRh } from '../../lib/api/rh';
import type { AlerteRh } from '../../lib/rh/types';
import { Badge } from '../ui/Badge';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const TON = { HAUTE: 'clay', MOYENNE: 'gold', BASSE: 'muted' } as const;
const PRIORITE = { HAUTE: 'Urgente', MOYENNE: 'À traiter', BASSE: 'À compléter' } as const;

/** Alertes RH (A3.5) : produites à chaque lecture, elles disparaissent quand leur cause disparaît. */
export function OngletAlertes() {
  const [a, setA] = useState<AlerteRh[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getAlertesRh().then(setA).catch((x) => setErreur(messageChargement(x)));
  }, []);
  if (!a) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  if (!a.length) return <p className="rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucune alerte : dossiers complets, aucune échéance proche.</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface" data-testid="alertes-rh">
      {a.map((x) => (
        <li key={x.cle} data-testid="alerte-rh" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold">{x.libelle} — {x.nom}</div>
            <div className="text-[12px] text-text-muted">{x.detail}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={TON[x.priorite]}>{PRIORITE[x.priorite]}</Badge>
            <Link href={x.lien} className="text-[12.5px] font-semibold text-accent">Ouvrir</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
