'use client';

import { useState, type FormEvent } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { createSubtask, toggleSubtask } from '../../lib/api/tasks';
import type { Task } from '../../lib/tasks/types';

export function SubtaskChecklist({
  parentId,
  subtasks,
  onChange,
}: {
  parentId: string;
  subtasks: Task[];
  onChange: (subtasks: Task[]) => void;
}) {
  const { getUserLabel } = useOrg();
  const [title, setTitle] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = subtasks.filter((s) => s.status === 'TERMINEE').length;

  async function handleToggle(subtask: Task) {
    setBusyId(subtask.id);
    setNotice(null);
    try {
      const updated = await toggleSubtask(subtask.id);
      onChange(subtasks.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Action impossible sur cette sous-tâche.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const created = await createSubtask(parentId, { title: title.trim() });
    onChange([...subtasks, created]);
    setTitle('');
  }

  return (
    <div>
      <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">
        Sous-tâches ({done}/{subtasks.length})
      </div>
      {subtasks.map((subtask) => (
        <div key={subtask.id} className="flex items-center gap-2.5 border-b border-line py-2.5 text-[13px] last:border-none">
          <button
            onClick={() => handleToggle(subtask)}
            disabled={busyId === subtask.id}
            aria-label={subtask.status === 'TERMINEE' ? 'Décocher' : 'Cocher comme terminée'}
            className={`h-[17px] w-[17px] flex-shrink-0 rounded-[5px] border-[1.6px] text-[11px] leading-none disabled:opacity-60 ${
              subtask.status === 'TERMINEE' ? 'border-sage bg-sage text-white' : 'border-line bg-surface'
            }`}
          >
            {subtask.status === 'TERMINEE' ? '✓' : ''}
          </button>
          <span className={subtask.status === 'TERMINEE' ? 'text-text-faint line-through' : ''}>{subtask.title}</span>
          {subtask.assignees[0] && (
            <span className="ml-auto text-[10.5px] text-text-faint">{getUserLabel(subtask.assignees[0].userId)}</span>
          )}
        </div>
      ))}

      {notice && <p className="mt-2 text-[12px] text-clay">{notice}</p>}

      <form onSubmit={handleAdd} className="mt-2.5 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ajouter une sous-tâche…"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
        />
      </form>
    </div>
  );
}
