'use client';

import { ListChecks, MessageSquare, Paperclip, Plus } from 'lucide-react';
import type { Task, TaskStatus } from '../../lib/tasks/types';
import { KANBAN_COLUMNS } from '../../lib/tasks/types';
import { PRIORITE_LIBELLE, PUCE_ECHEANCE, dateEcheance, tonEcheance } from '../../lib/tasks/affichage';
import { useOrg } from '../../lib/org/OrgProvider';
import { Avatars, BarreAvancement } from './ElementsTache';

const POINT_COLONNE: Record<TaskStatus, string> = {
  A_FAIRE: 'bg-[#8A90A3]',
  EN_COURS: 'bg-ink',
  SOUMISE_VALIDATION: 'bg-gold',
  TERMINEE: 'bg-sage',
};

/** Message utile d'une colonne vide. */
const VIDE: Record<TaskStatus, string> = {
  A_FAIRE: 'Aucune tâche à faire.',
  EN_COURS: 'Aucune tâche en cours : démarrez une tâche « À faire » pour la suivre ici.',
  SOUMISE_VALIDATION: 'Les tâches soumises attendent ici leur validation.',
  TERMINEE: 'Les tâches validées par votre chef apparaissent ici.',
};

const ETIQUETTE_PRIORITE: Record<Task['priority'], string> = {
  URGENT: 'bg-clay-50 text-clay',
  NORMAL: 'bg-ink-50 text-ink',
  FAIBLE: 'bg-[#F0F1F5] text-[#5C6270]',
};

/** « Chez Fatoumata Camara, cheffe de section » : qui valide une tâche soumise (le créateur s'il n'y est
 * pas assigné, sinon le chef). Information d'affichage : l'API reste seule juge de la validation. */
function useChezQui() {
  const { users, getUserLabel } = useOrg();
  return (t: Task) => {
    if (t.assignees.some((a) => a.userId === t.createdById)) return 'Chez votre chef';
    const fonction = users.find((u) => u.id === t.createdById)?.jobTitle;
    return `Chez ${getUserLabel(t.createdById)}${fonction ? `, ${fonction.charAt(0).toLowerCase()}${fonction.slice(1)}` : ''}`;
  };
}

function Carte({ task, onClick }: { task: Task; onClick: () => void }) {
  const ton = tonEcheance(task);
  const enCours = task.status === 'EN_COURS' || task.status === 'SOUMISE_VALIDATION';
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="carte-tache"
      className="mb-[9px] block w-full rounded-[10px] border border-[#E6E8F0] bg-surface px-3 py-[11px] text-left shadow-[0_1px_2px_rgba(18,28,77,0.07)] hover:border-ink/30"
    >
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`rounded-[5px] px-[7px] py-0.5 text-[11px] font-bold ${ETIQUETTE_PRIORITE[task.priority]}`}>{PRIORITE_LIBELLE[task.priority]}</span>
        {task.dueDate && <span className={`rounded-[5px] px-[7px] py-0.5 text-[12px] font-semibold ${PUCE_ECHEANCE[ton]}`}>{dateEcheance(task)}</span>}
      </span>
      <b className="block text-[13.5px] font-semibold leading-[1.35]">{task.title}</b>
      {task.confidentiality !== 'PUBLIC_INTERNE' && <span className="mt-1 inline-block rounded-[5px] bg-clay-50 px-1.5 text-[11px] font-semibold text-clay">Confidentiel</span>}
      {task.activiteLibelle && <span className="mt-1 block truncate text-[12px] text-text-muted">{task.activiteLibelle}</span>}
      {enCours && (
        <span className="mt-[9px] flex">
          <BarreAvancement valeur={task.progressPercent ?? 0} />
        </span>
      )}
      <span className="mt-2.5 flex items-center gap-2.5 text-[12px] text-text-muted">
        {!!task.nbSousTaches && (
          <span className="flex items-center gap-1">
            <ListChecks aria-label="Sous-tâches" size={13} /> {task.nbSousTachesFaites ?? 0}/{task.nbSousTaches}
          </span>
        )}
        {!!task.nbPiecesJointes && (
          <span className="flex items-center gap-1">
            <Paperclip aria-label="Pièces jointes" size={13} /> {task.nbPiecesJointes}
          </span>
        )}
        {!!task.nbCommentaires && (
          <span className="flex items-center gap-1">
            <MessageSquare aria-label="Commentaires" size={13} /> {task.nbCommentaires}
          </span>
        )}
        <span className="ml-auto">
          <Avatars tache={task} />
        </span>
      </span>
    </button>
  );
}

/**
 * Tableau Kanban (refonte de l'interface, maquette validée) : colonnes À faire, En cours,
 * En validation (« Chez [nom], [fonction] »), Terminées ; colonne vide = message utile ;
 * « Ajouter une tâche » seulement si `onAjouter` (droit de créer donné par l'API).
 */
export function KanbanBoard({ tasks, onSelect, onAjouter }: { tasks: Task[]; onSelect: (id: string) => void; onAjouter?: () => void }) {
  const chezQui = useChezQui();
  return (
    <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {KANBAN_COLUMNS.map((colonne) => {
        const liste = tasks.filter((t) => t.status === colonne.status);
        return (
          <section key={colonne.status} aria-label={colonne.label} data-testid={`colonne-${colonne.status}`} className="rounded-xl bg-[#EBEDF4] p-2.5 sm:min-h-[320px]">
            <h3 className="flex items-center gap-2 px-1 pb-2.5 pt-1 text-[13.5px] font-bold text-ink-900">
              <i aria-hidden className={`h-[9px] w-[9px] rounded-full ${POINT_COLONNE[colonne.status]}`} />
              {colonne.label}
              <span className="ml-auto rounded-[10px] bg-surface px-2 py-px text-[12px] font-bold text-text-muted">{liste.length}</span>
            </h3>
            {liste.length === 0 ? (
              <p className="rounded-[10px] border-[1.5px] border-dashed border-[#C9CDDD] bg-white/50 px-3 py-[18px] text-center text-[13px] text-text-muted">{VIDE[colonne.status]}</p>
            ) : (
              liste.map((t) => (
                <div key={t.id}>
                  <Carte task={t} onClick={() => onSelect(t.id)} />
                  {colonne.status === 'SOUMISE_VALIDATION' && <p className="-mt-1 mb-2.5 px-1 text-[12.5px] text-text-muted">{chezQui(t)}</p>}
                </div>
              ))
            )}
            {colonne.status === 'A_FAIRE' && onAjouter && (
              <button type="button" onClick={onAjouter} className="flex w-full items-center gap-1.5 rounded-lg p-2 text-[13px] font-semibold text-text-muted hover:bg-white/60 hover:text-ink">
                <Plus aria-hidden size={16} /> Ajouter une tâche
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
