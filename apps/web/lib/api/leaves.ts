import { apiFetch } from './client';
import type { CreateLeaveRequestInput, LeaveBalanceView, LeaveRequest, LeaveType } from '../leaves/types';

export function getLeaveTypes(): Promise<LeaveType[]> {
  return apiFetch<LeaveType[]>('/leave-types');
}

export function getLeaveRequests(): Promise<LeaveRequest[]> {
  return apiFetch<LeaveRequest[]>('/leaves');
}

export function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>('/leaves', { method: 'POST', body: JSON.stringify(input) });
}

export function donnerAvisConge(id: string, avis: 'FAVORABLE' | 'DEFAVORABLE', motif?: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/avis`, { method: 'POST', body: JSON.stringify({ avis, ...(motif ? { motif } : {}) }) });
}

export function getLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}`);
}

export function approveLeaveRequest(id: string, comment?: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/approve`, { method: 'POST', body: JSON.stringify({ comment }) });
}

export function rejectLeaveRequest(id: string, comment: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) });
}

export function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/cancel`, { method: 'POST' });
}

export function getMyBalances(): Promise<LeaveBalanceView[]> {
  return apiFetch<LeaveBalanceView[]>('/leaves/balances/me');
}

export function getBalancesForUser(userId: string): Promise<LeaveBalanceView[]> {
  return apiFetch<LeaveBalanceView[]>(`/leaves/balances/${userId}`);
}
