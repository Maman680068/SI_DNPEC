'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { addAttachments, broadcastTask } from '../../lib/api/tasks';
import type { BroadcastMode, Task, TaskPriority } from '../../lib/tasks/types';
import { Case, ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, ZoneDepot, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { OPTIONS_PRIORITE } from './CreateTaskModal';

/** « Diffuser une tâche à une division » : une tâche par membre actif, ou une tâche collective. */
export function BroadcastTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (tasks: Task[]) => void;
}) {
  const { user: currentUser } = useAuth();
  const { divisions } = useOrg();
  const toast = useToast();

  // Un Chef de Division n'a de toute façon autorité que sur la sienne
  // (TasksService.broadcastToDivision) — pas la peine de lui montrer les autres.
  // Une division suspendue (§2.3) est également exclue : diffuser une tâche y
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

  async function handleSubmit() {
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
      let documentsOk = true;
      if (files.length > 0) {
        const results = await Promise.allSettled(tasks.map((t) => addAttachments(t.id, files)));
        documentsOk = !results.some((r) => r.status === 'rejected');
      }
      const division = selectableDivisions.find((d) => d.id === divisionId)?.name ?? 'la division';
      const membres = new Set(tasks.flatMap((t) => t.assignees.map((a) => a.userId))).size;
      if (documentsOk)
        toast.succes(mode === 'INDIVIDUAL' ? `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} diffusée${tasks.length > 1 ? 's' : ''}` : 'Tâche collective diffusée', {
          detail: `${membres} membre${membres > 1 ? 's' : ''} de ${division} ${membres > 1 ? 'ont été prévenus' : 'a été prévenu'}.`,
        });
      else toast.erreur('Tâches diffusées sans tous leurs documents', 'Les documents de référence n’ont pas pu être joints à toutes les tâches. Vérifiez chaque tâche.');
      onCreated(tasks);
    } catch (err) {
      setError(messageErreur(err, 'La tâche n’a pas pu être diffusée.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Diffuser une tâche à une division"
      onClose={onClose}
      onSubmit={handleSubmit}
      libelleValider="Diffuser la tâche"
      enCours={submitting}
      erreur={error}
      testid="fenetre-diffuser-tache"
      pied="Chaque membre actif de la division est prévenu immédiatement."
      valider={() => (title.trim().length < 2 ? { 'diffusion-titre': title.trim() ? 'Le titre doit compter au moins 2 caractères.' : 'Donnez un titre à la tâche.' } : {})}
    >
      <Grille2>
        <Liste
          id="diffusion-division"
          label="Division"
          value={divisionId}
          onChange={setDivisionId}
          required
          vide={selectableDivisions.length === 0 ? 'Aucune division disponible' : undefined}
          messageObligatoire="Choisissez une division."
          options={selectableDivisions.map((d) => ({ value: d.id, label: d.name }))}
        />
        <ChoixSegment<BroadcastMode>
          id="diffusion-mode"
          label="Mode de diffusion"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'INDIVIDUAL', label: 'Tâches individuelles' },
            { value: 'COLLECTIVE', label: 'Tâche collective' },
          ]}
        />
      </Grille2>
      <p className="-mt-2 mb-3.5 text-[12px] text-text-muted" data-testid="explication-mode">
        {mode === 'INDIVIDUAL' ? 'Une tâche par membre actif, statut indépendant pour chacune.' : 'Une seule tâche, tous les membres actifs en co-responsables.'}
      </p>
      <Saisie id="diffusion-titre" label="Titre" value={title} onChange={setTitle} required maxLength={300} messageObligatoire="Donnez un titre à la tâche." />
      <ZoneTexte id="diffusion-description" label="Description" facultatif value={description} onChange={setDescription} placeholder="Ce qui est attendu, les sources à utiliser…" />
      <Grille2>
        <ChoixSegment<TaskPriority> id="diffusion-priorite" label="Priorité" options={OPTIONS_PRIORITE} value={priority} onChange={setPriority} />
        <ChampDate id="diffusion-echeance" label="Échéance" value={dueDate} onChange={setDueDate} />
      </Grille2>
      <ZoneDepot
        id="diffusion-documents"
        label="Documents de référence"
        facultatif
        multiple
        fichiers={files}
        onChange={setFiles}
        aide="Joints à chaque tâche créée · PDF, Word, Excel, images · 25 Mo au plus par fichier"
      />
      <Case id="diffusion-document-obligatoire" label="Un document est obligatoire avant la soumission pour validation" checked={documentRequired} onChange={setDocumentRequired} />
    </FenetreFormulaire>
  );
}
