import type { Task } from '../../lib/tasks/types';
import { Badge } from '../ui/Badge';

const PRIORITY_BORDER: Record<Task['priority'], string> = {
  URGENT: 'before:bg-clay',
  NORMAL: 'before:bg-accent',
  FAIBLE: 'before:bg-text-faint',
};

function formatDueDate(dueDate: string | null): { label: string; late: boolean } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const late = due.getTime() < Date.now();
  return { label: due.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), late };
}

export function TaskCard({ task }: { task: Task }) {
  const due = formatDueDate(task.dueDate);

  return (
    <div
      className={`relative mb-2.5 overflow-hidden rounded-md border border-line bg-surface p-3.5 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:content-[''] ${PRIORITY_BORDER[task.priority]}`}
    >
      {task.confidentiality !== 'PUBLIC_INTERNE' && (
        <Badge tone="clay" className="mb-2">
          Confidentiel
        </Badge>
      )}
      <div className="mb-2.5 text-[13.6px] font-semibold leading-snug">{task.title}</div>

      {task.progressPercent > 0 && (
        <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-text-muted">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-sage" style={{ width: `${task.progressPercent}%` }} />
          </div>
          <span>{task.progressPercent}%</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex">
          {task.assignees.slice(0, 3).map((assignee, i) => (
            <div
              key={assignee.id}
              className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-[7px] border-2 border-surface bg-accent-soft text-[10px] font-bold text-accent first:ml-0"
              style={{ zIndex: 10 - i }}
            >
              •
            </div>
          ))}
        </div>
        {due && (
          <div className={`text-[11px] ${due.late ? 'font-bold text-clay' : 'text-text-faint'}`}>
            {due.late ? '⚠ ' : ''}
            {due.label}
          </div>
        )}
      </div>
    </div>
  );
}
