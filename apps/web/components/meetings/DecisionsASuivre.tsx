'use client';

import type { DecisionsASuivre as Donnees } from '../../lib/meetings/types';
import { STATUT_LIBELLE } from '../../lib/tasks/affichage';
import { dateCourte } from '../../lib/meetings/affichage';
import { Pastille } from '../ui/Charte';
import { Barre } from '../ui/Squelette';

/** Panneau « Décisions à suivre » (maquette Réunions) : retards en rouge, décisions devenues des tâches. */
export function DecisionsASuivre({ donnees, erreur, onOuvrir }: { donnees: Donnees | null; erreur: string | null; onOuvrir: (meetingId: string) => void }) {
  return (
    <section aria-label="Décisions à suivre" data-testid="decisions-a-suivre" className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
        <h2 className="font-heading text-[15.5px] font-bold text-ink-900">Décisions à suivre</h2>
        {donnees && donnees.enRetard > 0 && (
          <span className="ml-auto">
            <Pastille ton="rouge" testid="decisions-en-retard">
              {donnees.enRetard} en retard
            </Pastille>
          </span>
        )}
      </div>
      {erreur ? (
        <p className="border-t border-[#F0F1F6] px-4 py-3 text-[13px] text-clay">{erreur}</p>
      ) : !donnees ? (
        <div role="status" aria-label="Chargement en cours" data-testid="squelette" className="space-y-3 border-t border-[#F0F1F6] px-4 py-4">
          <Barre className="h-3 w-[75%]" />
          <Barre className="h-3 w-[60%]" />
          <Barre className="h-3 w-[68%]" />
        </div>
      ) : donnees.decisions.length === 0 ? (
        <p className="border-t border-[#F0F1F6] px-4 py-3 text-[13px] text-text-muted">Aucune décision à suivre : elles se consignent dans la fenêtre d’une réunion.</p>
      ) : (
        <ul className="max-h-[560px] overflow-y-auto" tabIndex={0} aria-label="Liste des décisions à suivre">
          {donnees.decisions.map((d) => {
            const close = d.status === 'CLOTUREE';
            const origine = `Réunion du ${dateCourte(d.meeting.startAt)}`;
            const suivi = close
              ? 'fait'
              : d.action
                ? `devenue une tâche · ${STATUT_LIBELLE[d.action.status].toLowerCase()}${d.action.dueDate ? ` · échéance ${dateCourte(d.action.dueDate)}` : ''}`
                : 'à convertir en action';
            return (
              <li key={d.id} data-testid="decision-a-suivre" className="border-t border-[#F0F1F6]">
                <button type="button" onClick={() => onOuvrir(d.meetingId)} className="relative block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[#F6F7FC]">
                  <b className={`block font-semibold ${close ? 'text-text-muted' : 'text-text'}`}>{d.content}</b>
                  <span className={`block text-[12.5px] ${d.enRetard ? 'font-semibold text-clay' : 'text-text-muted'}`}>
                    {origine} · {d.enRetard ? `en retard · ${suivi}` : suivi}
                  </span>
                  <span className="sr-only"> — {d.meeting.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
