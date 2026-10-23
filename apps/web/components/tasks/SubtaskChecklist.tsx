'use client';

import { useState, type FormEvent } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { createSubtask, toggleSubtask } from '../../lib/api/tasks';
import type { Task } from '../../lib/tasks/types';
import { Check } from 'lucide-react';
import { messageErreur, useToast } from '../ui/Toast';

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
  const [ajout, setAjout] = useState(false);
  const toast = useToast();

  const done = subtasks.filter((s) => s.status === 'TERMINEE').length;

  async function handleToggle(subtask: Task, liste: Task[] = subtasks, annulable = true) {
    setBusyId(subtask.id);
    try {
      const updated = await toggleSubtask(subtask.id);
      const suivante = liste.map((s) => (s.id === updated.id ? updated : s));
      onChange(suivante);
      // « Annuler » : la même route remet la sous-tâche dans l'état précédent.
      toast.succes(updated.status === 'TERMINEE' ? 'Sous-tâche terminée' : 'Sous-tâche rouverte', {
        detail: updated.title,
        annuler: annulable ? () => handleToggle(updated, suivante, false) : undefined,
      });
    } catch (err) {
      toast.erreur('Action impossible', messageErreur(err, 'La sous-tâche n’a pas pu être modifiée.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const t = title.trim();
    if (t.length < 2) {
      toast.erreur('Titre trop court', 'Le titre d’une sous-tâche compte au moins 2 caractères.');
      return;
    }
    setAjout(true);
    try {
      const created = await createSubtask(parentId, { title: t });
      onChange([...subtasks, created]);
      setTitle('');
      toast.succes('Sous-tâche ajoutée', { detail: created.title });
    } catch (err) {
      toast.erreur('Action impossible', messageErreur(err, 'La sous-tâche n’a pas pu être ajoutée.'));
    } finally {
      setAjout(false);
    }
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900">
        Sous-tâches <span className="font-semibold text-text-faint">{done}/{subtasks.length}</span>
      </h3>
      {subtasks.map((subtask) => (
        <div key={subtask.id} className="flex items-center gap-2.5 border-b border-line-doux py-[7px] text-[13.5px]">
          <button
            onClick={() => handleToggle(subtask)}
            disabled={busyId === subtask.id}
            aria-label={subtask.status === 'TERMINEE' ? 'Décocher' : 'Cocher comme terminée'}
            role="checkbox"
            aria-checked={subtask.status === 'TERMINEE'}
            className={`grid h-[17px] w-[17px] flex-shrink-0 place-items-center rounded-[5px] border-[1.6px] disabled:opacity-60 ${
              subtask.status === 'TERMINEE' ? 'border-sage bg-sage text-white' : 'border-line-fort bg-surface'
            }`}
          >
            {subtask.status === 'TERMINEE' && <Check aria-hidden size={12} strokeWidth={3} />}
          </button>
          <span className={subtask.status === 'TERMINEE' ? 'text-text-muted line-through' : ''}>{subtask.title}</span>
          {subtask.assignees[0] && (
            <span className="ml-auto text-[10.5px] text-text-faint">{getUserLabel(subtask.assignees[0].userId)}</span>
          )}
        </div>
      ))}

      <form onSubmit={handleAdd} className="mt-2.5 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ajouter une sous-tâche…"
          aria-label="Ajouter une sous-tâche"
          disabled={ajout}
          className="flex-1 rounded-[9px] border border-line bg-surface px-3 py-1.5 text-[13px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
        />
      </form>
    </div>
  );
}
