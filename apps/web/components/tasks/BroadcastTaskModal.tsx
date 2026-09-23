'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { addAttachments, broadcastTask } from '../../lib/api/tasks';
import type { BroadcastMode, Task, TaskPriority } from '../../lib/tasks/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function BroadcastTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (tasks: Task[]) => void;
}) {
  const { user: currentUser } = useAuth();
  const { divisions } = useOrg();

  // Un Chef de Division n'a de toute façon autorité que sur la sienne
  // (TasksService.broadcastToDivision) — pas la peine de lui montrer les autres.
  // Une division suspendue (§2.6 bis) est également exclue : diffuser une tâche y
  // ferait croître l'activité d'une unité gelée, bloqué côté API de toute façon.
  const activeDivisions = divisions.filter((d) => d.isActive);
  const selectableDivisions =
    currentUser?.role === 'CHEF_DIVISION'
      ? activeDivisions.filter((d) => d.id === currentUser.divisionId)
      : activeDivisions;

  const [divisionId, setDivisionId] = useState(selectableDivisions[0]?.id ?? '');
  const [mode, setMode] = useState<BroadcastMode>('INDIVIDUAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [documentRequired, setDocumentRequired] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const tasks = await broadcastTask({
        divisionId,
        mode,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        documentRequired,
      });
      // Mêmes documents copiés indépendamment sur chaque tâche créée — pas une
      // seule pièce jointe partagée entre plusieurs tâches (voir lib/api/tasks.ts) :
      // supprimer un exemplaire depuis une tâche ne doit jamais affecter les autres.
      if (files.length > 0) {
        const results = await Promise.allSettled(tasks.map((t) => addAttachments(t.id, files)));
        if (results.some((r) => r.status === 'rejected')) {
          window.alert(
            'Les tâches ont été créées, mais les documents de référence n’ont pas pu être joints à toutes. Vérifiez chaque tâche et réessayez si besoin.',
          );
        }
      }
      onCreated(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de diffuser la tâche');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Diffuser une tâche à une division</h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Division</label>
          <select
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {selectableDivisions.length === 0 && <option value="">Aucune division disponible</option>}
            {selectableDivisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Mode de diffusion</label>
          <div className="space-y-2 rounded-md border border-line p-3">
            <label className="flex items-start gap-2 text-[13px]">
              <input
                type="radio"
                name="broadcast-mode"
                className="mt-0.5"
                checked={mode === 'INDIVIDUAL'}
                onChange={() => setMode('INDIVIDUAL')}
              />
              <span>
                <span className="font-semibold">Tâches individuelles</span>
                <br />
                <span className="text-text-faint">Une tâche par membre actif, statut indépendant pour chacune.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[13px]">
              <input
                type="radio"
                name="broadcast-mode"
                className="mt-0.5"
                checked={mode === 'COLLECTIVE'}
                onChange={() => setMode('COLLECTIVE')}
              />
              <span>
                <span className="font-semibold">Tâche collective</span>
                <br />
                <span className="text-text-faint">Une seule tâche, tous les membres actifs en co-responsables.</span>
              </span>
            </label>
          </div>
        </div>

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
            <p className="mt-1 text-[11.5px] text-text-faint">
              {files.length} fichier(s) — joints à chaque tâche créée
            </p>
          )}
        </div>

        <label className="mb-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={documentRequired} onChange={(e) => setDocumentRequired(e.target.checked)} />
          Document obligatoire avant soumission pour validation
        </label>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !title.trim() || !divisionId}>
            {submitting ? 'Diffusion…' : 'Diffuser'}
          </Button>
        </div>
      </form>
    </div>
  );
}
