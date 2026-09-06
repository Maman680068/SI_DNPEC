'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { addAttachments, createTask } from '../../lib/api/tasks';
import type { Task, TaskPriority } from '../../lib/tasks/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

/** Personne à pré-assigner à l'ouverture, typiquement choisie depuis l'Annuaire —
 * donc potentiellement hors du périmètre cascade (`useOrg().users`) qui alimente
 * la liste normale. On l'ajoute à la liste affichée sans rien présumer de plus :
 * POST /tasks revérifie l'autorité côté serveur pour CHAQUE assigné (voir
 * TasksService.assertCanAssignAll), qu'il vienne de la liste cascade ou d'ici. */
export interface PresetAssignee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
}

export function CreateTaskModal({
  onClose,
  onCreated,
  presetAssignee,
}: {
  onClose: () => void;
  onCreated: (task: Task) => void;
  presetAssignee?: PresetAssignee;
}) {
  const { user: currentUser } = useAuth();
  const { users } = useOrg();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [documentRequired, setDocumentRequired] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(presetAssignee ? [presetAssignee.id] : []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cascadeAssignable = users.filter((u) => u.id !== currentUser?.id);
  const assignableUsers =
    presetAssignee && !cascadeAssignable.some((u) => u.id === presetAssignee.id)
      ? [presetAssignee, ...cascadeAssignable]
      : cascadeAssignable;

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
        documentRequired,
        divisionId: currentUser?.divisionId ?? undefined,
        sectionId: currentUser?.sectionId ?? undefined,
        celluleId: currentUser?.celluleId ?? undefined,
        assignees: assigneeIds.map((userId) => ({ userId })),
      });
      // La tâche existe déjà à ce stade — un échec d'upload n'annule pas sa
      // création. La fenêtre se ferme via onCreated juste après, donc un
      // message d'erreur affiché dans la fenêtre ne serait jamais vu :
      // window.alert() est le seul moyen simple de garantir qu'il l'est.
      if (files.length > 0) {
        try {
          await addAttachments(task.id, files);
        } catch {
          window.alert(
            'La tâche a été créée, mais les documents de référence n’ont pas pu être joints. Réessayez depuis le détail de la tâche.',
          );
        }
      }
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
        <h2 className="mb-5 text-[19px] font-semibold">
          {presetAssignee ? `Nouvelle tâche pour ${presetAssignee.firstName} ${presetAssignee.lastName}` : 'Nouvelle tâche'}
        </h2>

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

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Documents de référence <span className="font-normal text-text-faint">(facultatif)</span>
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-[12.5px]"
          />
          {files.length > 0 && (
            <p className="mt-1 text-[11.5px] text-text-faint">{files.length} fichier(s) sélectionné(s)</p>
          )}
        </div>

        <label className="mb-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={documentRequired} onChange={(e) => setDocumentRequired(e.target.checked)} />
          Document obligatoire avant soumission pour validation
        </label>

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
