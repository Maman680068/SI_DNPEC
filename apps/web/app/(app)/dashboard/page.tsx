'use client';

import { useCallback, useEffect, useState } from 'react';
import { getTasks, getDashboard } from '../../../lib/api/tasks';
import type { Task, TaskDashboard } from '../../../lib/tasks/types';
import { KpiRow } from '../../../components/tasks/KpiRow';
import { ViewToggle, type TaskView } from '../../../components/tasks/ViewToggle';
import { KanbanBoard } from '../../../components/tasks/KanbanBoard';
import { CalendarView } from '../../../components/tasks/CalendarView';
import { TaskDetailDrawer } from '../../../components/tasks/TaskDetailDrawer';
import { CreateTaskModal } from '../../../components/tasks/CreateTaskModal';
import { Button } from '../../../components/ui/Button';

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [dashboard, setDashboard] = useState<TaskDashboard | null>(null);
  const [view, setView] = useState<TaskView>('kanban');
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(() => {
    Promise.all([getTasks(), getDashboard()])
      .then(([tasksResult, dashboardResult]) => {
        setTasks(tasksResult);
        setDashboard(dashboardResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les tâches'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleTaskChanged(updated: Task) {
    setTasks((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? prev);
    getDashboard().then(setDashboard);
  }

  function handleCreated(task: Task) {
    setTasks((prev) => (prev ? [task, ...prev] : [task]));
    setShowCreateModal(false);
    getDashboard().then(setDashboard);
    setSelectedTaskId(task.id);
  }

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Mon périmètre</div>
          <h1 className="text-[22px] font-extrabold">Tableau de bord</h1>
        </div>
        <Button variant="gold" onClick={() => setShowCreateModal(true)}>
          + Nouvelle tâche
        </Button>
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
        <KanbanBoard tasks={tasks} onSelect={setSelectedTaskId} />
      ) : (
        <CalendarView tasks={tasks} onSelect={setSelectedTaskId} />
      )}

      <TaskDetailDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskChanged={handleTaskChanged} />
      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
    </div>
  );
}
