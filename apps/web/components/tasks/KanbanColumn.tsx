import type { Task } from '../../lib/tasks/types';
import { TaskCard } from './TaskCard';

export function KanbanColumn({ label, tasks, onSelect }: { label: string; tasks: Task[]; onSelect: (id: string) => void }) {
  return (
    <div className="rounded-xl bg-[#EEF1F4] p-3">
      <div className="mb-3 flex items-center justify-between px-1.5 pt-1">
        <span className="text-[12.5px] font-bold tracking-wide text-text-muted">{label}</span>
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-bold text-text-muted">
          {tasks.length}
        </span>
      </div>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onClick={() => onSelect(task.id)} />
      ))}
      {tasks.length === 0 && (
        <div className="rounded-md border-[1.5px] border-dashed border-line py-4 text-center text-[12px] font-semibold text-text-faint">
          Aucune tâche
        </div>
      )}
    </div>
  );
}
