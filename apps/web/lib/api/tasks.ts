import { apiFetch } from './client';
import type { Task, TaskDashboard } from '../tasks/types';

export function getTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/tasks');
}

export function getDashboard(): Promise<TaskDashboard> {
  return apiFetch<TaskDashboard>('/tasks/dashboard');
}
