'use client';

import type { Task } from '../../lib/tasks/types';
import { PRIORITE_COULEUR, PRIORITE_LIBELLE, STATUT_LIBELLE, STATUT_PASTILLE, estEnRetard } from '../../lib/tasks/affichage';
import { useOrg } from '../../lib/org/OrgProvider';

/** Petits éléments communs aux vues des tâches (refonte de l'interface, maquettes validées). */

/** Point de statut (tableau de bord) : cercle vide, demi-plein en cours, ambre en validation, rouge en retard. */
export function PointStatut({ tache }: { tache: Task }) {
  const retard = estEnRetard(tache);
  const style =
    tache.status === 'EN_COURS'
      ? { borderColor: 'rgb(var(--c-ink))', background: 'conic-gradient(rgb(var(--c-ink)) 0 50%, transparent 50%)' }
      : tache.status === 'SOUMISE_VALIDATION'
        ? { borderColor: 'rgb(var(--c-ambre-vif))', background: 'conic-gradient(rgb(var(--c-ambre-vif)) 0 90%, transparent 90%)' }
        : tache.status === 'TERMINEE'
          ? { borderColor: 'var(--couleur-sage)', background: 'var(--couleur-sage)' }
          : { borderColor: retard ? 'rgb(var(--c-clay))' : 'rgb(var(--c-texte-faint))' };
  return <span aria-hidden className="block h-3.5 w-3.5 flex-none rounded-full border-2" style={style} />;
}

export function PastilleStatut({ status }: { status: Task['status'] }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[12px] font-semibold ${STATUT_PASTILLE[status]}`}>
      <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-current" />
      {STATUT_LIBELLE[status]}
    </span>
  );
}

export function Priorite({ priority }: { priority: Task['priority'] }) {
  return (
    <span className="flex items-center gap-[5px] text-[12.5px] font-semibold">
      <i aria-hidden className={`inline-block h-2 w-2 rounded-[2px] ${PRIORITE_COULEUR[priority]}`} />
      {PRIORITE_LIBELLE[priority]}
    </span>
  );
}

export function BarreAvancement({ valeur, couleur }: { valeur: number; couleur?: string }) {
  return (
    <div className="h-[5px] flex-1 overflow-hidden rounded-[3px] bg-fond-gris" role="progressbar" aria-valuenow={valeur} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
      <i className="block h-full rounded-[3px]" style={{ width: `${Math.max(0, Math.min(100, valeur))}%`, background: couleur ?? 'var(--couleur-sage)' }} />
    </div>
  );
}

export function Avancement({ valeur }: { valeur: number }) {
  return (
    <div className="flex items-center gap-[7px] text-[12px] text-text-muted">
      <BarreAvancement valeur={valeur} />
      <span className="w-8 text-right">{valeur}%</span>
    </div>
  );
}

/** Initiales des personnes assignées, en pile (3 au plus, puis « +n »). */
export function Avatars({ tache, max = 3 }: { tache: Task; max?: number }) {
  const { getUserInitials, getUserLabel } = useOrg();
  const ids = tache.assignees.map((a) => a.userId);
  const vus = ids.slice(0, max);
  return (
    <div className="flex" aria-label={ids.length ? `Équipe : ${ids.map(getUserLabel).join(', ')}` : 'Aucune personne assignée'} role="img">
      {vus.map((id, i) => (
        <span key={id} title={getUserLabel(id)} className={`grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-ink-50 text-[10px] font-bold text-ink ${i ? '-ml-1.5' : ''}`}>
          {getUserInitials(id)}
        </span>
      ))}
      {ids.length > max && <span className="-ml-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-fond-gris text-[10px] font-bold text-text-muted">+{ids.length - max}</span>}
    </div>
  );
}
