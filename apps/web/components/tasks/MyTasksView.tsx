'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { getTasks } from '../../lib/api/tasks';
import type { Task } from '../../lib/tasks/types';
import { KanbanBoard } from './KanbanBoard';
import { TaskDetailDrawer } from './TaskDetailDrawer';

type Tab = 'assigned' | 'created';

/**
 * « Mes tâches » : les tâches de la personne connectée, en son nom propre —
 * assignées à elle, ou créées par elle — là où le tableau de bord montre tout
 * son périmètre. `initialTaskId` : ouverture directe d'une tâche (route
 * /tasks/:id, lien des emails de notification), y compris une tâche vue par
 * cascade qui ne figure dans aucun des deux onglets — le tiroir la charge
 * lui-même, l'API restant seule juge de la visibilité.
 */
export function MyTasksView({ initialTaskId = null }: { initialTaskId?: string | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [tab, setTab] = useState<Tab>('assigned');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getTasks()
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les tâches'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assigned = tasks?.filter((t) => t.assignees.some((a) => a.userId === user?.id)) ?? [];
  const created = tasks?.filter((t) => t.createdById === user?.id) ?? [];
  const shown = tab === 'assigned' ? assigned : created;

  function handleClose() {
    setSelectedTaskId(null);
    // Revenir à /tasks après une ouverture directe, pour qu'un rechargement ne
    // rouvre pas la tâche.
    if (initialTaskId) router.replace('/tasks');
  }

  function handleTaskChanged(updated: Task) {
    setTasks((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? prev);
  }

  return (
    <div>
      <div className="mb-[22px]">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
        <h1 className="text-[22px] font-extrabold">Mes tâches</h1>
      </div>

      {error && <div className="mb-5 rounded-md bg-clay-soft px-4 py-3 text-sm text-clay">{error}</div>}

      <div role="tablist" className="mb-4 flex w-fit gap-0.5 rounded-md border border-line bg-bg p-0.5">
        {(
          [
            { key: 'assigned', label: 'Assignées à moi', count: assigned.length },
            { key: 'created', label: 'Créées par moi', count: created.length },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            role="tab"
            aria-selected={tab === option.key}
            onClick={() => setTab(option.key)}
            className={`rounded-[6px] px-3.5 py-1.5 text-[12.5px] font-semibold ${
              tab === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
            }`}
          >
            {option.label}
            {tasks && <span className="ml-1.5 text-text-faint">{option.count}</span>}
          </button>
        ))}
      </div>

      {!tasks ? (
        <div className="text-sm text-text-muted">Chargement des tâches…</div>
      ) : (
        <KanbanBoard tasks={shown} onSelect={setSelectedTaskId} />
      )}

      <TaskDetailDrawer taskId={selectedTaskId} onClose={handleClose} onTaskChanged={handleTaskChanged} />
    </div>
  );
}
