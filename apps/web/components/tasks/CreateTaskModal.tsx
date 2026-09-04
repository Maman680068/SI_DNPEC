'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { createTask } from '../../lib/api/tasks';
import type { Task, TaskPriority } from '../../lib/tasks/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: (task: Task) => void }) {
  const { user: currentUser } = useAuth();
  const { users } = useOrg();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignableUsers = users.filter((u) => u.id !== currentUser?.id);

  function toggleAssignee(userId: string) {
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        divisionId: currentUser?.divisionId ?? undefined,
        sectionId: currentUser?.sectionId ?? undefined,
        celluleId: currentUser?.celluleId ?? undefined,
        assignees: assigneeIds.map((userId) => ({ userId })),
      });
      onCreated(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer la tâche');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Nouvelle tâche</h2>

        <Field label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
            >
              <option value="FAIBLE">Faible</option>
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <Field label="Échéance" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        {assignableUsers.length > 0 && (
          <div className="mb-4">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Assigner à</label>
            <div className="max-h-32 overflow-y-auto rounded-md border border-line p-2">
              {assignableUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 py-1 text-[13px]">
                  <input type="checkbox" checked={assigneeIds.includes(u.id)} onChange={() => toggleAssignee(u.id)} />
                  {u.firstName} {u.lastName}
                  {u.jobTitle && <span className="text-text-faint"> · {u.jobTitle}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !title.trim()}>
            {submitting ? 'Création…' : 'Créer la tâche'}
          </Button>
        </div>
      </form>
    </div>
  );
}
