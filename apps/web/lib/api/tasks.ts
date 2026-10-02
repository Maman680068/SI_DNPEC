import { apiFetch, API_BASE_URL, authHeaders, appelApi } from './client';
import type { BroadcastTaskInput, CreateTaskInput, Task, TaskAttachment, TaskComment, TaskDashboard } from '../tasks/types';

/** Filtres de GET /tasks utilisés par les écrans (voir TaskFiltersDto côté API). */
export interface FiltresTaches {
  assigneeId?: string;
  createdById?: string;
  /** Vue de suivi : tâches non closes, et closes depuis moins de 30 jours. */
  suivi?: boolean;
  /** Nombre maximal de tâches (échéances les plus proches d'abord). */
  limite?: number;
}

export function getTasks(filtres: FiltresTaches = {}): Promise<Task[]> {
  const p = new URLSearchParams();
  if (filtres.assigneeId) p.set('assigneeId', filtres.assigneeId);
  if (filtres.createdById) p.set('createdById', filtres.createdById);
  if (filtres.suivi) p.set('suivi', 'true');
  if (filtres.limite) p.set('limite', String(filtres.limite));
  const qs = p.toString();
  return apiFetch<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
}

/** Voir TasksService.broadcastToDivision — renvoie toujours un tableau (1 tâche
 * en mode COLLECTIVE, une par membre en mode INDIVIDUAL), pour que l'appelant
 * n'ait pas à distinguer les deux formes de réponse. */
export function broadcastTask(input: BroadcastTaskInput): Promise<Task[]> {
  return apiFetch<Task[]>('/tasks/broadcast', { method: 'POST', body: JSON.stringify(input) });
}

export function getDashboard(): Promise<TaskDashboard> {
  return apiFetch<TaskDashboard>('/tasks/dashboard');
}

export function getTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`);
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return apiFetch<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) });
}

export function getSubtasks(parentId: string): Promise<Task[]> {
  return apiFetch<Task[]>(`/tasks/${parentId}/subtasks`);
}

export function createSubtask(parentId: string, input: CreateTaskInput): Promise<Task> {
  return apiFetch<Task>(`/tasks/${parentId}/subtasks`, { method: 'POST', body: JSON.stringify(input) });
}

/** Bascule fait/pas fait (À faire <-> Terminée) — réservé aux sous-tâches, voir
 * TasksService.toggleSubtaskCompletion. Les tâches racines gardent start/submit/validate/reject. */
export function toggleSubtask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/toggle`, { method: 'POST' });
}

export function startTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/start`, { method: 'POST' });
}

export function submitTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/submit`, { method: 'POST' });
}

export function validateTask(id: string, comment?: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/validate`, { method: 'POST', body: JSON.stringify({ comment }) });
}

export function rejectTask(id: string, comment: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) });
}

/** Voir TasksService.updateProgress — refusé (409) si la tâche a des sous-tâches. */
export function updateProgress(id: string, progressPercent: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progressPercent }) });
}

export function getComments(taskId: string): Promise<TaskComment[]> {
  return apiFetch<TaskComment[]>(`/tasks/${taskId}/comments`);
}

export function addComment(taskId: string, body: string, mentionedUserIds: string[]): Promise<TaskComment> {
  return apiFetch<TaskComment>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body, mentionedUserIds: mentionedUserIds.length ? mentionedUserIds : undefined }),
  });
}

export function getAttachments(taskId: string): Promise<TaskAttachment[]> {
  return apiFetch<TaskAttachment[]>(`/tasks/${taskId}/attachments`);
}

/** Un ou plusieurs fichiers en un seul appel — voir TasksController.addAttachments. */
export function addAttachments(taskId: string, files: File[]): Promise<TaskAttachment[]> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  return apiFetch<TaskAttachment[]>(`/tasks/${taskId}/attachments`, { method: 'POST', body: form });
}

export function removeAttachment(taskId: string, attachmentId: string): Promise<void> {
  return apiFetch<void>(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

/** Hors apiFetch : la réponse est un flux binaire, pas du JSON — même mécanisme
 * que documents.ts (downloadVersion), déclenche un téléchargement navigateur. */
export async function downloadAttachment(taskId: string, attachmentId: string, fileName: string): Promise<void> {
  const res = await appelApi(`${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}/download`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Téléchargement impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
