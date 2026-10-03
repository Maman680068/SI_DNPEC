'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Paperclip, MessageSquare } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { startTask, submitTask } from '../../lib/api/tasks';
import type { Task } from '../../lib/tasks/types';
import { GROUPES_ECHEANCE, PUCE_ECHEANCE, STATUT_LIBELLE, actionDirecte, dateEcheance, groupeEcheance, tonEcheance } from '../../lib/tasks/affichage';
import { Avancement, Avatars, PointStatut } from '../tasks/ElementsTache';

/** Unité d'une tâche (section, cellule, sinon division). */
export function useUniteTache() {
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();
  return (t: Task) => getSectionName(t.sectionId) ?? getCelluleName(t.celluleId) ?? getDivisionName(t.divisionId) ?? '';
}

/**
 * Tâches du tableau de bord groupées par échéance (En retard, Cette semaine, Plus tard), avec un
 * bouton d'action directe (Démarrer, Soumettre, Voir) — maquette « Mes priorités ».
 */
export function ListeTachesTableau({
  taches,
  onOuvrir,
  onChange,
  inclureTerminees = false,
  maxParGroupe,
  lienSuite,
}: {
  taches: Task[];
  onOuvrir: (id: string) => void;
  onChange: (t: Task) => void;
  inclureTerminees?: boolean;
  /** Tableau compact : au plus ce nombre de lignes par groupe, puis un lien vers la liste complète. */
  maxParGroupe?: number;
  lienSuite?: string;
}) {
  const { user } = useAuth();
  const unite = useUniteTache();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function agir(t: Task, action: 'demarrer' | 'soumettre') {
    setEnCours(t.id);
    setErreur(null);
    try {
      onChange(await (action === 'demarrer' ? startTask(t.id) : submitTask(t.id)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setEnCours(null);
    }
  }

  const groupes = GROUPES_ECHEANCE.filter((g) => inclureTerminees || g.cle !== 'terminees')
    .map((g) => ({ ...g, taches: taches.filter((t) => groupeEcheance(t) === g.cle) }))
    .filter((g) => g.taches.length > 0);

  return (
    <div>
      {erreur && (
        <div role="alert" className="mx-[18px] mt-3 rounded-md bg-clay-soft px-3 py-2 text-[13px] text-clay">
          {erreur}
        </div>
      )}
      {groupes.map((g) => (
        <div key={g.cle} role="group" aria-label={g.libelle}>
          <div className={`flex items-center gap-2 px-[18px] pb-1.5 pt-2.5 text-[12.5px] font-bold ${g.cle === 'retard' ? 'text-clay' : 'text-text-muted'}`}>
            {g.libelle} <span className="font-semibold text-text-faint">{g.taches.length}</span>
          </div>
          {g.taches.slice(0, maxParGroupe ?? g.taches.length).map((t, i) => {
            const a = actionDirecte(t, user?.id);
            const ton = tonEcheance(t);
            const primaire = a.action === 'soumettre' || (a.action === 'demarrer' && g.cle === 'retard');
            return (
              <div
                key={t.id}
                data-testid="ligne-priorite"
                className={`grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3.5 px-[18px] py-[9px] md:grid-cols-[16px_minmax(0,1fr)_110px_70px_58px_96px] ${i ? 'border-t border-[#F0F1F6]' : ''}`}
              >
                <PointStatut tache={t} />
                <button type="button" onClick={() => onOuvrir(t.id)} className="min-w-0 text-left">
                  <span className="block truncate text-[14px] font-semibold hover:underline">{t.title}</span>
                  <span className="flex items-center gap-2.5 text-[12.5px] text-text-muted">
                    <span className="truncate">
                      {t.activiteLibelle && !unite(t) ? `Plan de travail : ${t.activiteLibelle}` : unite(t)}
                      {t.status === 'SOUMISE_VALIDATION' ? ` · ${STATUT_LIBELLE[t.status].toLowerCase()}` : ''}
                    </span>
                    {!!t.nbPiecesJointes && (
                      <span className="flex flex-none items-center gap-1">
                        <Paperclip aria-label="Pièces jointes" size={13} /> {t.nbPiecesJointes}
                      </span>
                    )}
                    {!!t.nbCommentaires && (
                      <span className="flex flex-none items-center gap-1">
                        <MessageSquare aria-label="Commentaires" size={13} /> {t.nbCommentaires}
                      </span>
                    )}
                  </span>
                </button>
                <div className="hidden md:block">
                  <Avancement valeur={t.progressPercent ?? 0} />
                </div>
                <span className={`hidden h-[22px] w-fit items-center rounded-md px-2 text-[12px] font-semibold md:inline-flex ${PUCE_ECHEANCE[ton]}`}>{dateEcheance(t)}</span>
                <div className="hidden md:block">
                  <Avatars tache={t} />
                </div>
                {a.action ? (
                  <button
                    type="button"
                    disabled={enCours === t.id}
                    onClick={() => agir(t, a.action!)}
                    className={`grid h-[30px] place-items-center rounded-[7px] border px-3 text-[12.5px] font-bold ${primaire ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:bg-bg'}`}
                    aria-label={`${a.libelle} : ${t.title}`}
                  >
                    {a.libelle}
                  </button>
                ) : (
                  <button type="button" onClick={() => onOuvrir(t.id)} className="grid h-[30px] place-items-center rounded-[7px] border border-line px-3 text-[12.5px] font-bold text-ink hover:bg-bg" aria-label={`${a.libelle} : ${t.title}`}>
                    {a.libelle}
                  </button>
                )}
              </div>
            );
          })}
          {maxParGroupe !== undefined && g.taches.length > maxParGroupe && (
            <Link href={lienSuite ?? '/tasks'} className="block border-t border-[#F0F1F6] px-[18px] py-2 text-[12.5px] font-semibold text-ink hover:underline">
              + {g.taches.length - maxParGroupe} autre{g.taches.length - maxParGroupe > 1 ? 's' : ''} tâche{g.taches.length - maxParGroupe > 1 ? 's' : ''} « {g.libelle.toLowerCase()} »
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/** Pied de panneau : lien vers la liste complète et un repère à droite. */
export function PiedPanneau({ href, libelle, droite }: { href: string; libelle: string; droite?: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line px-[18px] py-2.5 text-[13px] font-semibold text-ink">
      <Link href={href} className="hover:underline">
        {libelle}
      </Link>
      {droite && <span className="font-medium text-text-muted">{droite}</span>}
    </div>
  );
}
