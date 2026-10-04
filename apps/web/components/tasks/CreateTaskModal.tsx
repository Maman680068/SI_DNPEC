'use client';

import { useEffect, useState } from 'react';
import { getActivitesDisponibles } from '../../lib/api/pilotage';
import type { ActiviteDisponible } from '../../lib/pilotage/types';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { addAttachments, createTask } from '../../lib/api/tasks';
import type { Task, TaskPriority } from '../../lib/tasks/types';
import { PRIORITE_LIBELLE } from '../../lib/tasks/affichage';
import { Case, ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, SelecteurPersonnes, ZoneDepot, ZoneTexte, type Personne } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

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

/** Priorités dans l'ordre de la maquette (Basse, Normale, Haute). */
export const OPTIONS_PRIORITE: { value: TaskPriority; label: string }[] = (['FAIBLE', 'NORMAL', 'URGENT'] as TaskPriority[]).map((p) => ({ value: p, label: PRIORITE_LIBELLE[p] }));

/** « Aïssatou Barry et Kadiatou Touré ont été prévenues. » (accord neutre). */
export function phrasePrevenus(noms: string[]): string {
  if (noms.length === 0) return '';
  const liste = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
  return `${liste} ${noms.length > 1 ? 'ont été prévenus' : 'a été prévenu'}.`;
}

/**
 * « Nouvelle tâche » (refonte, étape 9, maquette `apres-form-tache`) : titre, description, priorité en
 * un clic, échéance, personnes assignées, activité du plan, documents de référence, document
 * obligatoire. Les personnes proposées sont celles du périmètre (l'API revérifie chaque assigné).
 */
export function CreateTaskModal({
  onClose,
  onCreated,
  presetAssignee,
  presetActiviteId,
}: {
  onClose: () => void;
  onCreated: (task: Task) => void;
  presetAssignee?: PresetAssignee;
  /** Socle N5 : création depuis une activité du plan de travail. */
  presetActiviteId?: string;
}) {
  const { user: currentUser } = useAuth();
  const { users, getUserLabel } = useOrg();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [documentRequired, setDocumentRequired] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(presetAssignee ? [presetAssignee.id] : []);
  const [activiteId, setActiviteId] = useState(presetActiviteId ?? '');
  const [activites, setActivites] = useState<ActiviteDisponible[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cascadeAssignable = users.filter((u) => u.id !== currentUser?.id);
  const assignableUsers =
    presetAssignee && !cascadeAssignable.some((u) => u.id === presetAssignee.id)
      ? [presetAssignee, ...cascadeAssignable]
      : cascadeAssignable;
  const personnes: Personne[] = assignableUsers.map((u) => ({ id: u.id, nom: `${u.firstName} ${u.lastName}`, detail: u.jobTitle }));

  // Activités proposées par l'API (plans visibles) ; une liste vide masque le champ.
  useEffect(() => {
    getActivitesDisponibles()
      .then(setActivites)
      .catch(() => setActivites([]));
  }, []);

  async function handleSubmit() {
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
        activiteId: activiteId || undefined,
      });
      // La tâche existe déjà à ce stade — un échec d'envoi des documents n'annule pas sa création.
      let documentsOk = true;
      if (files.length > 0) {
        try {
          await addAttachments(task.id, files);
        } catch {
          documentsOk = false;
        }
      }
      const noms = assigneeIds.map((id) => personnes.find((p) => p.id === id)?.nom ?? getUserLabel(id));
      if (documentsOk) toast.succes('Tâche créée', { detail: phrasePrevenus(noms) || 'Elle apparaît dans « Créées par moi ».' });
      else toast.erreur('Tâche créée sans ses documents', 'Les documents de référence n’ont pas pu être joints. Ajoutez-les depuis le détail de la tâche.');
      onCreated(task);
    } catch (err) {
      setError(messageErreur(err, 'La tâche n’a pas pu être créée.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre={presetAssignee ? `Nouvelle tâche pour ${presetAssignee.firstName} ${presetAssignee.lastName}` : 'Nouvelle tâche'}
      onClose={onClose}
      onSubmit={handleSubmit}
      libelleValider="Créer la tâche"
      enCours={submitting}
      erreur={error}
      testid="fenetre-nouvelle-tache"
      valider={() => (title.trim().length < 2 ? { 'tache-titre': title.trim() ? 'Le titre doit compter au moins 2 caractères.' : 'Donnez un titre à la tâche.' } : {})}
      pied={assignableUsers.length > 0 ? 'Les personnes assignées sont prévenues immédiatement.' : 'La tâche apparaît aussitôt dans « Créées par moi ».'}
    >
      <Saisie id="tache-titre" label="Titre" value={title} onChange={setTitle} required maxLength={300} messageObligatoire="Donnez un titre à la tâche." />
      <ZoneTexte id="tache-description" label="Description" facultatif value={description} onChange={setDescription} placeholder="Ce qui est attendu, les sources à utiliser…" lignes={3} />
      <Grille2>
        <ChoixSegment<TaskPriority> id="tache-priorite" label="Priorité" options={OPTIONS_PRIORITE} value={priority} onChange={setPriority} />
        <ChampDate id="tache-echeance" label="Échéance" value={dueDate} onChange={setDueDate} />
      </Grille2>
      {assignableUsers.length > 0 && (
        <SelecteurPersonnes
          id="tache-assignes"
          label="Assigner à"
          options={personnes}
          valeurs={assigneeIds}
          onChange={setAssigneeIds}
          placeholder="Rechercher une personne de votre équipe…"
        />
      )}
      {activites.length > 0 && (
        <Liste
          id="tache-activite"
          label="Activité du plan de travail"
          facultatif
          value={activiteId}
          onChange={setActiviteId}
          vide="Aucune"
          options={activites.map((a) => ({ value: a.id, label: `${a.libelle} — ${a.objectif} (${a.unite})` }))}
        />
      )}
      <ZoneDepot id="tache-documents" label="Documents de référence" facultatif multiple fichiers={files} onChange={setFiles} />
      <Case id="tache-document-obligatoire" label="Un document est obligatoire avant la soumission pour validation" checked={documentRequired} onChange={setDocumentRequired} />
    </FenetreFormulaire>
  );
}
