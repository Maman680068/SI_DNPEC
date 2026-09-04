'use client';

import { useEffect, useState } from 'react';
import { getTasks, getDashboard } from '../../../lib/api/tasks';
import type { Task, TaskDashboard } from '../../../lib/tasks/types';
import { KpiRow } from '../../../components/tasks/KpiRow';
import { ViewToggle, type TaskView } from '../../../components/tasks/ViewToggle';
import { KanbanBoard } from '../../../components/tasks/KanbanBoard';
import { CalendarView } from '../../../components/tasks/CalendarView';

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [dashboard, setDashboard] = useState<TaskDashboard | null>(null);
  const [view, setView] = useState<TaskView>('kanban');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTasks(), getDashboard()])
      .then(([tasksResult, dashboardResult]) => {
        setTasks(tasksResult);
        setDashboard(dashboardResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les tâches'));
  }, []);

  return (
    <div>
      <div className="mb-5.5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Mon périmètre</div>
          <h1 className="text-[22px] font-extrabold">Tableau de bord</h1>
        </div>
      </div>

      {error && <div className="mb-5 rounded-md bg-clay-soft px-4 py-3 text-sm text-clay">{error}</div>}

      {dashboard && <KpiRow dashboard={dashboard} />}

      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold">Suivi des tâches</h2>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {!tasks ? (
        <div className="text-sm text-text-muted">Chargement des tâches…</div>
      ) : view === 'kanban' ? (
        <KanbanBoard tasks={tasks} />
      ) : (
        <CalendarView tasks={tasks} />
      )}
    </div>
  );
}
