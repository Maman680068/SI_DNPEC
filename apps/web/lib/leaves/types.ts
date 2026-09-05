export type LeaveRequestStatus = 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE' | 'ANNULEE';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approverId: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  leaveType: { code: string; name: string };
  user: { id: string; firstName: string; lastName: string; divisionId: string | null; sectionId: string | null; celluleId: string | null };
}

export interface LeaveBalanceView {
  id: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export const STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  EN_ATTENTE: 'En attente',
  APPROUVEE: 'Approuvée',
  REJETEE: 'Rejetée',
  ANNULEE: 'Annulée',
};

export const LEADERSHIP_ROLES_FOR_LEAVES = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];
