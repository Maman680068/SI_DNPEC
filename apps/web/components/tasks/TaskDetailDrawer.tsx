'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
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
  updateProgress,
  validateTask,
} from '../../lib/api/tasks';
import type { Task, TaskAttachment, TaskComment } from '../../lib/tasks/types';
import { STATUS_STEPS } from '../../lib/tasks/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SubtaskChecklist } from './SubtaskChecklist';
import { CommentThread } from './CommentThread';

const PRIORITY_LABEL: Record<Task['priority'], string> = { URGENT: 'Urgent', NORMAL: 'Normal', FAIBLE: 'Faible' };
const CONFIDENTIALITY_LABEL: Record<Task['confidentiality'], string> = {
  PUBLIC_INTERNE: 'Public interne',
  CONFIDENTIEL_DIVISION: 'Confidentiel',
  TRES_CONFIDENTIEL_DIRIGEANTS: 'Très confidentiel',
};

const LEADERSHIP_LIKE_ROLES = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

export function TaskDetailDrawer({
  taskId,
  onClose,
  onTaskChanged,
}: {
  taskId: string | null;
  onClose: () => void;
  onTaskChanged: (task: Task) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getDivisionName, getSectionName, getCelluleName, getUserLabel } = useOrg();
  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [progressDraft, setProgressDraft] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setActionError(null);
    setShowRejectForm(false);
    setAttachmentError(null);
    setAttachmentFiles([]);
    Promise.all([getTask(taskId), getSubtasks(taskId), getComments(taskId), getAttachments(taskId)])
      .then(([taskResult, subtasksResult, commentsResult, attachmentsResult]) => {
        setTask(taskResult);
        setSubtasks(subtasksResult);
        setComments(commentsResult);
        setAttachments(attachmentsResult);
        setProgressDraft(taskResult.progressPercent ?? 0);
      })
      .finally(() => setLoading(false));
  }, [taskId]);

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
  const isResponsable = task?.assignees.some((a) => a.userId === currentUser?.id && a.roleOnTask === 'RESPONSABLE') ?? false;
  const canStart = isCreator || isAssignee;
  const canSubmit = isCreator || isResponsable;
  const canDecide = isCreator || (currentUser ? LEADERSHIP_LIKE_ROLES.includes(currentUser.role) : false);
  // Même périmètre que la soumission (assertIsCreatorOrResponsable côté API) : un
  // simple Collaborateur peut démarrer la tâche mais pas déclarer son avancement.
  const canEditProgress = subtasks.length === 0 && (isCreator || isResponsable);

  async function handleAddAttachments() {
    if (!task || attachmentFiles.length === 0) return;
    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      const added = await addAttachments(task.id, attachmentFiles);
      setAttachments((prev) => [...added, ...prev]);
      setAttachmentFiles([]);
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setAttachmentBusy(false);
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
   * serveur (TasksService.recomputeParentProgress) — sans ce refetch, la
   * tâche affichée ici (et la carte Kanban derrière, via onTaskChanged)
   * resterait sur l'ancienne valeur jusqu'au prochain rechargement complet.
   */
  function handleSubtasksChange(next: Task[]) {
    setSubtasks(next);
    if (task) getTask(task.id).then(applyUpdate);
  }

  async function handleSaveProgress() {
    if (!task) return;
    setSavingProgress(true);
    setActionError(null);
    try {
      const updated = await updateProgress(task.id, progressDraft);
      applyUpdate(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setSavingProgress(false);
    }
  }

  const currentStepIndex = task ? STATUS_STEPS.findIndex((s) => s.status === task.status) : -1;

  const breadcrumbParts = task
    ? [getDivisionName(task.divisionId), getSectionName(task.sectionId) ?? getCelluleName(task.celluleId)].filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(20,26,38,0.42)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-[92vw] overflow-y-auto bg-surface px-[26px] pb-10 pt-[26px] sm:w-[460px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 flex items-start justify-between">
          <div className="text-xs text-text-faint">{breadcrumbParts.length ? breadcrumbParts.join(' → ') : ' '}</div>
          <button onClick={onClose} className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        {loading || !task ? (
          <p className="text-sm text-text-muted">Chargement…</p>
        ) : (
          <>
            <h2 className="mb-1.5 text-[19px] font-semibold leading-snug">{task.title}</h2>
            {task.documentRequired && (
              <Badge tone="clay" className="mb-3.5">
                Pièce jointe obligatoire avant soumission
              </Badge>
            )}

            <div className="mb-6 flex items-center">
              {STATUS_STEPS.map((step, i) => (
                <div key={step.status} className="relative flex-1 text-center">
                  {i < STATUS_STEPS.length - 1 && (
                    <div
                      className={`absolute left-[calc(50%+14px)] right-[calc(-50%+14px)] top-[11px] h-0.5 ${i < currentStepIndex ? 'bg-sage' : 'bg-line'}`}
                    />
                  )}
                  <div
                    className={`relative z-10 mx-auto mb-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold ${
                      i < currentStepIndex
                        ? 'bg-sage text-white'
                        : i === currentStepIndex
                          ? 'bg-gold text-ink'
                          : 'bg-line text-text-faint'
                    }`}
                  >
                    {i < currentStepIndex ? '✓' : i + 1}
                  </div>
                  <div className={`text-[10px] font-semibold ${i <= currentStepIndex ? 'text-text' : 'text-text-faint'}`}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-[22px] grid grid-cols-2 gap-3.5">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-text-faint">RESPONSABLES</div>
                <div className="text-[13.3px] font-semibold">
                  {task.assignees.length ? task.assignees.map((a) => getUserLabel(a.userId)).join(', ') : 'Aucun'}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-text-faint">PRIORITÉ</div>
                <div className="text-[13.3px] font-semibold">{PRIORITY_LABEL[task.priority]}</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-text-faint">ÉCHÉANCE</div>
                <div className="text-[13.3px] font-semibold">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non définie'}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-text-faint">CONFIDENTIALITÉ</div>
                <div className="text-[13.3px] font-semibold">{CONFIDENTIALITY_LABEL[task.confidentiality]}</div>
              </div>
            </div>

            {task.status === 'SOUMISE_VALIDATION' && canDecide && (
              <div className="mb-5">
                {!showRejectForm ? (
                  <div className="flex gap-2.5">
                    <Button variant="solid" className="flex-1" disabled={actionBusy} onClick={() => runAction(() => validateTask(task.id))}>
                      Valider
                    </Button>
                    <Button variant="outline" className="flex-1" disabled={actionBusy} onClick={() => setShowRejectForm(true)}>
                      Rejeter
                    </Button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      placeholder="Motif du rejet (visible par la personne assignée)…"
                      rows={2}
                      className="mb-2 w-full rounded-md border border-line px-3 py-2 text-[13px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
                    />
                    <div className="flex gap-2.5">
                      <Button
                        variant="solid"
                        className="flex-1 !bg-clay !border-clay"
                        disabled={actionBusy || rejectComment.trim().length < 2}
                        onClick={() => runAction(() => rejectTask(task.id, rejectComment.trim()))}
                      >
                        Confirmer le rejet
                      </Button>
                      <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {task.status === 'A_FAIRE' && canStart && (
              <Button variant="solid" className="mb-5 w-full" disabled={actionBusy} onClick={() => runAction(() => startTask(task.id))}>
                Démarrer
              </Button>
            )}
            {task.status === 'EN_COURS' && canSubmit && (
              <Button variant="gold" className="mb-5 w-full" disabled={actionBusy} onClick={() => runAction(() => submitTask(task.id))}>
                Soumettre pour validation
              </Button>
            )}
            {task.status === 'TERMINEE' && (
              <div className="mb-5">
                <Badge tone="sage">Terminée</Badge>
                {task.validationComment && <p className="mt-2 text-[13px] text-text-muted">{task.validationComment}</p>}
              </div>
            )}
            {task.status === 'EN_COURS' && task.validationComment && (
              <div className="mb-5 rounded-md bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">
                Rejet : {task.validationComment}
              </div>
            )}
            {actionError && <div className="mb-5 rounded-md bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">{actionError}</div>}

            <div className="mb-[22px]">
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">Avancement</div>
              {canEditProgress ? (
                <div className="flex items-center gap-2.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progressDraft}
                    onChange={(e) => setProgressDraft(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-[13px] font-semibold">{progressDraft}%</span>
                  <Button
                    variant="outline"
                    disabled={savingProgress || progressDraft === (task.progressPercent ?? 0)}
                    onClick={handleSaveProgress}
                  >
                    {savingProgress ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-sage" style={{ width: `${task.progressPercent ?? 0}%` }} />
                  </div>
                  <span className="text-[13px] font-semibold">{task.progressPercent ?? 0}%</span>
                </div>
              )}
              {subtasks.length > 0 && (
                <p className="mt-1.5 text-[11.5px] text-text-faint">
                  Calculé automatiquement à partir de l&apos;avancement des sous-tâches.
                </p>
              )}
            </div>

            {task.description && (
              <>
                <div className="mb-2.5 mt-[22px] text-xs font-bold uppercase tracking-wide text-text-muted">Description</div>
                <div className="mb-[22px] rounded-md bg-bg p-3.5 text-[13.5px] leading-relaxed">{task.description}</div>
              </>
            )}

            <div className="mb-[22px]">
              <SubtaskChecklist parentId={task.id} subtasks={subtasks} onChange={handleSubtasksChange} />
            </div>

            <div className="mb-[22px]">
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">Pièces jointes</div>
              {attachments.length ? (
                attachments.map((att) => (
                  <div key={att.id} className="mb-1.5 flex items-center justify-between gap-2.5 rounded-md bg-bg px-3.5 py-2.5 text-[13.5px]">
                    <button
                      type="button"
                      onClick={() => downloadAttachment(task.id, att.id, att.fileName)}
                      className="truncate font-semibold hover:underline"
                      title="Télécharger"
                    >
                      📎 {att.fileName}
                    </button>
                    {(att.uploadedById === currentUser?.id || isCreator) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="flex-shrink-0 text-[11.5px] font-semibold text-text-faint hover:text-clay"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="mb-2.5 text-[13px] text-text-faint">Aucune pièce jointe.</p>
              )}

              {(isCreator || isAssignee) && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setAttachmentFiles(Array.from(e.target.files ?? []))}
                    className="min-w-0 flex-1 text-[12px]"
                  />
                  <Button
                    variant="outline"
                    disabled={attachmentFiles.length === 0 || attachmentBusy}
                    onClick={handleAddAttachments}
                  >
                    {attachmentBusy ? 'Envoi…' : 'Ajouter'}
                  </Button>
                </div>
              )}
              {attachmentError && <p className="mt-1.5 text-[12px] text-clay">{attachmentError}</p>}
            </div>

            <div>
              <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">Commentaires</div>
              <CommentThread taskId={task.id} comments={comments} onPosted={(c) => setComments([...comments, c])} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
