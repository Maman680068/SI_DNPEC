'use client';

import { useState } from 'react';
import { cancelLeaveRequest } from '../../lib/api/leaves';
import type { LeaveRequest, LeaveRequestStatus } from '../../lib/leaves/types';
import { STATUS_LABEL } from '../../lib/leaves/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const STATUS_TONE: Record<LeaveRequestStatus, 'sage' | 'gold' | 'clay' | 'muted'> = {
  EN_ATTENTE: 'gold',
  APPROUVEE: 'sage',
  REJETEE: 'clay',
  ANNULEE: 'muted',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function LeaveRequestList({
  requests,
  onChange,
}: {
  requests: LeaveRequest[];
  onChange: (request: LeaveRequest) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (requests.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucune demande de congé pour l&apos;instant.</p>;
  }

  async function handleCancel(id: string) {
    setBusyId(id);
    try {
      const updated = await cancelLeaveRequest(id);
      onChange(updated);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Card key={request.id} className="p-[18px]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[14px] font-bold">{request.leaveType.name}</div>
            <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
          </div>
          <div className="text-[13px] text-text-muted">
            Du {formatDate(request.startDate)} au {formatDate(request.endDate)} · {request.daysCount} jour
            {request.daysCount > 1 ? 's' : ''}
          </div>
          {request.reason && <p className="mt-1.5 text-[12.5px] text-text-faint">{request.reason}</p>}

          {request.status === 'REJETEE' && request.decisionComment && (
            <div className="mt-2.5 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay">
              Motif du rejet : {request.decisionComment}
            </div>
          )}
          {request.status === 'APPROUVEE' && request.decisionComment && (
            <div className="mt-2.5 rounded-md bg-sage-soft px-3 py-2 text-[12.5px] text-sage">
              {request.decisionComment}
            </div>
          )}

          {(request.status === 'EN_ATTENTE' || request.status === 'APPROUVEE') && (
            <div className="mt-3">
              <Button variant="outline" disabled={busyId === request.id} onClick={() => handleCancel(request.id)}>
                Annuler la demande
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
