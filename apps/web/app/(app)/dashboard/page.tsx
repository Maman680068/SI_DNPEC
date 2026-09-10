'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getTasks, getDashboard } from '../../../lib/api/tasks';
import { exportDashboardPdf, exportTasksExcel } from '../../../lib/api/export';
import type { Task, TaskDashboard } from '../../../lib/tasks/types';
import { KpiRow } from '../../../components/tasks/KpiRow';
import { ViewToggle, type TaskView } from '../../../components/tasks/ViewToggle';
import { KanbanBoard } from '../../../components/tasks/KanbanBoard';
import { CalendarView } from '../../../components/tasks/CalendarView';
import { TaskDetailDrawer } from '../../../components/tasks/TaskDetailDrawer';
import { CreateTaskModal } from '../../../components/tasks/CreateTaskModal';
import { BroadcastTaskModal } from '../../../components/tasks/BroadcastTaskModal';
import { Button } from '../../../components/ui/Button';

/** Rôles pouvant plausiblement diffuser une tâche à une division (voir
 * CascadeService.canBroadcastToDivision) — DN/DNA n'importe laquelle, Chef de
 * Division la sienne. Indication côté client uniquement : le serveur reste
 * seul juge (voir assertCanBroadcastToDivision). */
const CAN_BROADCAST_ROLES = ['DN', 'DNA', 'CHEF_DIVISION'];

export default function DashboardPage() {
  const { user: currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [dashboard, setDashboard] = useState<TaskDashboard | null>(null);
  const [view, setView] = useState<TaskView>('kanban');
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const canBroadcast = CAN_BROADCAST_ROLES.includes(currentUser?.role ?? '');

  async function handleExport(kind: 'excel' | 'pdf') {
    setExporting(kind);
    setError(null);
    try {
      await (kind === 'excel' ? exportTasksExcel() : exportDashboardPdf());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de générer l'export");
    } finally {
      setExporting(null);
    }
  }

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

  function handleBroadcastCreated(created: Task[]) {
    setTasks((prev) => (prev ? [...created, ...prev] : created));
    setShowBroadcastModal(false);
    getDashboard().then(setDashboard);
  }

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Mon périmètre</div>
          <h1 className="text-[22px] font-extrabold">Tableau de bord</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" disabled={exporting !== null} onClick={() => handleExport('excel')}>
            {exporting === 'excel' ? 'Export…' : 'Exporter (Excel)'}
          </Button>
          <Button variant="outline" disabled={exporting !== null} onClick={() => handleExport('pdf')}>
            {exporting === 'pdf' ? 'Export…' : 'Exporter (PDF)'}
          </Button>
          {canBroadcast && (
            <Button variant="outline" onClick={() => setShowBroadcastModal(true)}>
              Diffuser à une division
            </Button>
          )}
          <Button variant="gold" onClick={() => setShowCreateModal(true)}>
            + Nouvelle tâche
          </Button>
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
        <KanbanBoard tasks={tasks} onSelect={setSelectedTaskId} />
      ) : (
        <CalendarView tasks={tasks} onSelect={setSelectedTaskId} />
      )}

      <TaskDetailDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onTaskChanged={handleTaskChanged} />
      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
      {showBroadcastModal && (
        <BroadcastTaskModal onClose={() => setShowBroadcastModal(false)} onCreated={handleBroadcastCreated} />
      )}
    </div>
  );
}
