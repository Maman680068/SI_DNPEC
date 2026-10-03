'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Check, CircleCheck, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useInterim } from '../../lib/interim/InterimProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import {
  addAttachments,
  downloadAttachment,
  getAttachments,
  getComments,
  getSubtasks,
  getTask,
  rejectTask,
  removeAttachment,
  startTask,
  submitTask,
  validateTask,
} from '../../lib/api/tasks';
import { getActivite } from '../../lib/api/pilotage';
import type { Task, TaskAttachment, TaskComment } from '../../lib/tasks/types';
import { STATUS_STEPS } from '../../lib/tasks/types';
import { dateEcheance, tonEcheance } from '../../lib/tasks/affichage';
import { FenetreDetail } from '../ui/FenetreDetail';
import { SubtaskChecklist } from './SubtaskChecklist';
import { CommentThread } from './CommentThread';
import { DocumentsIssus } from '../documents/DocumentsIssus';
import { BarreAvancement, PastilleStatut, Priorite } from './ElementsTache';

const CONFIDENTIALITY_LABEL: Record<Task['confidentiality'], string> = {
  PUBLIC_INTERNE: 'Public interne',
  CONFIDENTIEL_DIVISION: 'Confidentiel',
  TRES_CONFIDENTIEL_DIRIGEANTS: 'Très confidentiel',
};

const LEADERSHIP_LIKE_ROLES = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

/** Vignette d'extension d'une pièce jointe (PDF rouge, tableur vert, texte bleu, autre gris). */
function Extension({ nom }: { nom: string }) {
  const ext = (nom.split('.').pop() ?? '').toLowerCase();
  const [libelle, couleur] =
    ext === 'pdf' ? ['PDF', '#C8102E'] : ['xls', 'xlsx', 'csv', 'ods'].includes(ext) ? ['XLS', '#197C43'] : ['doc', 'docx', 'odt', 'txt'].includes(ext) ? ['DOC', '#1B2A6B'] : [ext.slice(0, 4).toUpperCase() || 'FIC', '#5C6270'];
  return (
    <span aria-hidden className="grid h-[34px] w-[30px] flex-none place-items-center rounded-[5px] text-[9.5px] font-extrabold text-white" style={{ background: couleur }}>
      {libelle}
    </span>
  );
}

const taille = (o: number) => (o >= 1_048_576 ? `${(o / 1_048_576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);

function Personne({ id }: { id: string }) {
  const { getUserLabel, getUserInitials } = useOrg();
  return (
    <span className="flex items-center gap-[7px]">
      <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink-50 text-[10px] font-bold text-ink">{getUserInitials(id)}</span>
      <span>{getUserLabel(id)}</span>
    </span>
  );
}

/**
 * Fiche d'une tâche dans une fenêtre centrée (refonte de l'interface, maquette validée) : en-tête
 * (fil d'Ariane de l'unité, titre, étapes du statut) ; à gauche description, sous-tâches, pièces
 * jointes (dépôt), documents issus, commentaires ; à droite les actions permises puis les
 * informations. Remplace l'ancien panneau latéral partout (Mes tâches, tableau de bord, /tasks/[id]).
 */
export function FenetreTache({
  taskId,
  onClose,
  onTaskChanged,
  activiteLibelle,
}: {
  taskId: string | null;
  onClose: () => void;
  onTaskChanged: (task: Task) => void;
  /** Libellé de l'activité du plan, s'il est déjà connu de la liste. */
  activiteLibelle?: string | null;
}) {
  const { user: currentUser } = useAuth();
  const { interim, effectiveRole } = useInterim();
  const { getDivisionName, getSectionName, getCelluleName, getUserLabel } = useOrg();
  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activite, setActivite] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setLoadError(null);
    setTask(null);
    setActionError(null);
    setShowRejectForm(false);
    setAttachmentError(null);
    setActivite(null);
    Promise.all([getTask(taskId), getSubtasks(taskId), getComments(taskId), getAttachments(taskId)])
      .then(([taskResult, subtasksResult, commentsResult, attachmentsResult]) => {
        setTask(taskResult);
        setSubtasks(subtasksResult);
        setComments(commentsResult);
        setAttachments(attachmentsResult);
      })
      // Tâche hors périmètre ou introuvable (ex. lien direct /tasks/:id reçu par
      // email) : message de l'API plutôt qu'un « Chargement… » sans fin.
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Impossible de charger cette tâche'))
      .finally(() => setLoading(false));
  }, [taskId]);

  // Libellé de l'activité du plan : connu de la liste, sinon lu (si la personne peut la voir).
  useEffect(() => {
    if (!task?.activiteId) return;
    if (activiteLibelle) return setActivite(activiteLibelle);
    getActivite(task.activiteId)
      .then((a) => setActivite(a.libelle))
      .catch(() => setActivite('Activité du plan de travail'));
  }, [task?.activiteId, activiteLibelle]);

  if (!taskId) return null;

  function applyUpdate(updated: Task) {
    setTask(updated);
    onTaskChanged(updated);
  }

  async function runAction(action: () => Promise<Task>) {
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await action();
      applyUpdate(updated);
      setShowRejectForm(false);
      setRejectComment('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setActionBusy(false);
    }
  }

  const isCreator = task?.createdById === currentUser?.id;
  const isAssignee = task?.assignees.some((a) => a.userId === currentUser?.id) ?? false;
  // Intérim : le suppléant agit comme le titulaire pour la validation (créateur
  // ou rôle emprunté), mais jamais sur une tâche dont lui-même ou le titulaire
  // est assigné (même règle que l'API, TasksService.assertCanDecideValidation).
  const actingForCreator = !!interim && task?.createdById === interim.titulaireId;
  const actingForAssignee = !!interim && (task?.assignees.some((a) => a.userId === interim.titulaireId) ?? false);
  const isResponsable = task?.assignees.some((a) => a.userId === currentUser?.id && a.roleOnTask === 'RESPONSABLE') ?? false;
  const canStart = isCreator || isAssignee;
  const canSubmit = isCreator || isResponsable;
  const canDecide = !isAssignee && !actingForAssignee && (isCreator || actingForCreator || LEADERSHIP_LIKE_ROLES.includes(effectiveRole ?? ''));
  const canAttach = isCreator || isAssignee;

  async function deposer(fichiers: File[]) {
    if (!task || fichiers.length === 0) return;
    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      const added = await addAttachments(task.id, fichiers);
      setAttachments((prev) => [...added, ...prev]);
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setAttachmentBusy(false);
      if (champFichier.current) champFichier.current.value = '';
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    if (!task) return;
    setAttachmentError(null);
    try {
      await removeAttachment(task.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  /**
   * Ajouter ou cocher/décocher une sous-tâche recalcule progressPercent côté
   * serveur — sans ce refetch, la tâche affichée ici (et la ligne derrière, via
   * onTaskChanged) resterait sur l'ancienne valeur jusqu'au prochain rechargement.
   */
  function handleSubtasksChange(next: Task[]) {
    setSubtasks(next);
    if (task) getTask(task.id).then(applyUpdate).catch((err) => setActionError(err instanceof Error ? err.message : 'Impossible de recharger la tâche'));
  }

  const currentStepIndex = task ? STATUS_STEPS.findIndex((s) => s.status === task.status) : -1;
  const filAriane = task ? [getDivisionName(task.divisionId), getSectionName(task.sectionId) ?? getCelluleName(task.celluleId)] : [];

  const etapes = task && (
    <ol aria-label="Étapes du statut" className="mt-3.5 flex flex-wrap items-center gap-y-2">
      {STATUS_STEPS.map((step, i) => {
        const fait = i < currentStepIndex || task.status === 'TERMINEE';
        const courant = i === currentStepIndex && task.status !== 'TERMINEE';
        return (
          <li key={step.status} className="flex items-center" aria-current={courant ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className={`mx-2.5 h-0.5 w-6 sm:w-14 ${i <= currentStepIndex ? 'bg-sage' : 'bg-[#E1E4EE]'}`} />}
            <span className={`flex items-center gap-[7px] text-[12.5px] font-semibold ${fait ? 'text-sage' : courant ? 'text-ink-900' : 'text-text-muted'}`}>
              <b className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] ${fait ? 'bg-sage text-white' : courant ? 'bg-gold text-ink-900' : 'bg-[#ECEEF5] text-text-muted'}`}>
                {fait ? <Check aria-hidden size={12} strokeWidth={3} /> : i + 1}
              </b>
              {step.status === 'SOUMISE_VALIDATION' ? 'En validation' : step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );

  const titreSection = (libelle: string, n?: number) => (
    <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900">
      {libelle} {n !== undefined && <span className="font-semibold text-text-faint">{n}</span>}
    </h3>
  );

  const contenu = task && (
    <>
      {task.documentRequired && (
        <p className="mb-4 inline-flex rounded-md bg-clay-50 px-2.5 py-1 text-[12px] font-semibold text-clay">Pièce jointe obligatoire avant soumission</p>
      )}
      <section className="mb-[18px]">
        {titreSection('Description')}
        <p className="whitespace-pre-line text-[13.5px] leading-[1.55] text-[#3A4152]">{task.description || 'Aucune description.'}</p>
      </section>

      <section className="mb-[18px]">
        <SubtaskChecklist parentId={task.id} subtasks={subtasks} onChange={handleSubtasksChange} />
      </section>

      <section className="mb-[18px]">
        {titreSection('Pièces jointes', attachments.length)}
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex max-w-full items-center gap-[9px] rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px]">
              <Extension nom={att.fileName} />
              <span className="min-w-0">
                <button type="button" onClick={() => downloadAttachment(task.id, att.id, att.fileName)} className="block max-w-[260px] truncate text-left hover:underline" title="Télécharger">
                  {att.fileName}
                </button>
                <small className="block text-[11.5px] text-text-muted">
                  {taille(att.sizeBytes)} · {getUserLabel(att.uploadedById)}
                </small>
              </span>
              {(att.uploadedById === currentUser?.id || isCreator) && (
                <button type="button" onClick={() => handleRemoveAttachment(att.id)} className="ml-1 text-[11.5px] font-semibold text-text-faint hover:text-clay" aria-label={`Supprimer ${att.fileName}`}>
                  Supprimer
                </button>
              )}
            </div>
          ))}
          {attachments.length === 0 && !canAttach && <p className="text-[13px] text-text-faint">Aucune pièce jointe.</p>}
        </div>
        {canAttach && (
          <label
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setSurvol(true);
            }}
            onDragLeave={() => setSurvol(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setSurvol(false);
              void deposer(Array.from(e.dataTransfer.files));
            }}
            className={`mt-2 inline-flex cursor-pointer items-center gap-2 rounded-[9px] border-[1.5px] border-dashed px-3.5 py-2 text-[13px] font-semibold text-text-muted focus-within:outline focus-within:outline-2 focus-within:outline-ink ${survol ? 'border-ink bg-ink-50' : 'border-[#C3C8DA]'}`}
          >
            <Plus aria-hidden size={16} />
            {attachmentBusy ? 'Envoi…' : 'Déposer un fichier'}
            <input ref={champFichier} type="file" multiple className="sr-only" onChange={(e) => void deposer(Array.from(e.target.files ?? []))} />
          </label>
        )}
        {attachmentError && <p className="mt-1.5 text-[12px] text-clay">{attachmentError}</p>}
      </section>

      <DocumentsIssus
        source={{
          tacheId: task.id,
          libelle: `tâche « ${task.title} »`,
          periodeDebut: task.createdAt.slice(0, 10),
          periodeFin: (task.dueDate ?? new Date().toISOString()).slice(0, 10),
        }}
      />

      <section>
        {titreSection('Commentaires', comments.length)}
        <CommentThread taskId={task.id} comments={comments} onPosted={(c) => setComments([...comments, c])} />
      </section>
    </>
  );

  const ton = task ? tonEcheance(task) : 'aucune';
  const cote = task && (
    <>
      <div className="mb-[18px] flex flex-col gap-2">
        {task.status === 'SOUMISE_VALIDATION' && canDecide && !showRejectForm && (
          <>
            <button type="button" disabled={actionBusy} onClick={() => runAction(() => validateTask(task.id))} className="flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-sage font-bold text-white disabled:opacity-60">
              <CircleCheck aria-hidden size={18} /> Valider la tâche
            </button>
            <button type="button" disabled={actionBusy} onClick={() => setShowRejectForm(true)} className="flex h-10 items-center justify-center rounded-[10px] border border-[#E7B3BB] bg-surface font-bold text-clay disabled:opacity-60">
              Rejeter avec un motif
            </button>
          </>
        )}
        {task.status === 'SOUMISE_VALIDATION' && canDecide && showRejectForm && (
          <div>
            <label htmlFor="motif-rejet" className="mb-1 block text-[12.5px] font-semibold">
              Motif du rejet
            </label>
            <textarea
              id="motif-rejet"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Motif du rejet (visible par la personne assignée)…"
              rows={3}
              className="mb-2 w-full rounded-[9px] border border-line px-3 py-2 text-[13px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
            />
            <div className="flex gap-2">
              <button type="button" disabled={actionBusy || rejectComment.trim().length < 2} onClick={() => runAction(() => rejectTask(task.id, rejectComment.trim()))} className="h-10 flex-1 rounded-[10px] bg-clay font-bold text-white disabled:opacity-60">
                Confirmer le rejet
              </button>
              <button type="button" onClick={() => setShowRejectForm(false)} className="h-10 rounded-[10px] border border-line px-3 font-semibold text-ink">
                Annuler
              </button>
            </div>
          </div>
        )}
        {task.status === 'A_FAIRE' && canStart && (
          <button type="button" disabled={actionBusy} onClick={() => runAction(() => startTask(task.id))} className="h-[42px] rounded-[10px] bg-ink font-bold text-white disabled:opacity-60">
            Démarrer
          </button>
        )}
        {task.status === 'EN_COURS' && canSubmit && (
          <button type="button" disabled={actionBusy} onClick={() => runAction(() => submitTask(task.id))} className="h-[42px] rounded-[10px] bg-gold font-bold text-ink-900 disabled:opacity-60">
            Soumettre pour validation
          </button>
        )}
        {task.status === 'SOUMISE_VALIDATION' && (
          <p className="text-[12px] leading-[1.45] text-text-muted">
            Soumise{task.submittedById ? ` par ${getUserLabel(task.submittedById)}` : ''}
            {task.submittedAt ? ` le ${new Date(task.submittedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}.
            {canDecide ? ' Un rejet renvoie la tâche « En cours » avec votre motif.' : ''}
          </p>
        )}
        {task.status === 'EN_COURS' && task.validationComment && <div className="rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">Rejet : {task.validationComment}</div>}
        {task.status === 'TERMINEE' && task.validationComment && <p className="text-[12.5px] text-text-muted">{task.validationComment}</p>}
        {actionError && (
          <div role="alert" className="rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">
            {actionError}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-y-[13px] text-[13px]">
        <dt className="text-text-muted">Statut</dt>
        <dd>
          <PastilleStatut status={task.status} />
        </dd>
        <dt className="text-text-muted">{task.assignees.length > 1 ? 'Responsables' : 'Responsable'}</dt>
        <dd className="space-y-1.5 font-semibold">{task.assignees.length ? task.assignees.map((a) => <Personne key={a.id} id={a.userId} />) : 'Aucun'}</dd>
        <dt className="text-text-muted">Créée par</dt>
        <dd className="font-semibold">
          <Personne id={task.createdById} />
        </dd>
        <dt className="text-text-muted">Échéance</dt>
        <dd className={`font-semibold ${ton === 'retard' ? 'text-clay' : ton === 'proche' ? 'text-ambre' : ''}`}>
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Non définie'}
          <span className="sr-only">{ton === 'retard' ? ' (en retard)' : ''}</span>
        </dd>
        <dt className="text-text-muted">Priorité</dt>
        <dd>
          <Priorite priority={task.priority} />
        </dd>
        <dt className="text-text-muted">Confidentialité</dt>
        <dd className="flex items-center gap-1.5 font-semibold">
          <Lock aria-hidden size={13} /> {CONFIDENTIALITY_LABEL[task.confidentiality]}
        </dd>
        <dt className="text-text-muted">Plan de travail</dt>
        <dd className="font-semibold">{task.activiteId ? (activite ?? '…') : '—'}</dd>
      </dl>
      <div className="my-4 h-px bg-line" />
      <h3 className="mb-2 text-[13px] font-bold text-ink-900">Avancement</h3>
      <div className="flex items-center gap-2.5">
        <BarreAvancement valeur={task.progressPercent ?? 0} />
        <span className="text-[13px] font-semibold">{task.progressPercent ?? 0} %</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-[1.45] text-text-muted" data-testid="avancement-calcule">
        {subtasks.length > 0
          ? 'Calculé automatiquement à partir des sous-tâches terminées.'
          : 'Calculé automatiquement selon le statut : à faire 0 %, en cours 50 %, soumise 90 %, terminée 100 %.'}
      </p>
      <p className="sr-only">Échéance courte : {dateEcheance(task)}</p>
    </>
  );

  return (
    <FenetreDetail titre={task?.title ?? (loadError ? 'Tâche indisponible' : 'Chargement…')} onClose={onClose} filAriane={filAriane} entete={etapes} cote={cote || undefined} testid="fenetre-tache">
      {loadError ? (
        <div role="alert" className="rounded-md bg-clay-soft px-3.5 py-3 text-[13px] text-clay">
          {loadError}
        </div>
      ) : loading || !task ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        contenu
      )}
    </FenetreDetail>
  );
}
