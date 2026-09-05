import { apiFetch } from './client';
import type { CreateTaskInput, Task, TaskAttachment, TaskComment, TaskDashboard } from '../tasks/types';

export function getTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/tasks');
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
