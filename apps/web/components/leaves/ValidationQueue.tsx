'use client';

import { useOrg } from '../../lib/org/OrgProvider';
import type { LeaveRequest } from '../../lib/leaves/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ValidationQueue({ requests, onSelect }: { requests: LeaveRequest[]; onSelect: (request: LeaveRequest) => void }) {
  const { getUserLabel } = useOrg();

  if (requests.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucune demande en attente de votre décision.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Card key={request.id} className="flex items-center justify-between gap-3 p-[18px]">
          <div>
            <div className="text-[14px] font-bold">{getUserLabel(request.userId)}</div>
            <div className="text-[13px] text-text-muted">
              {request.leaveType.name} · Du {formatDate(request.startDate)} au {formatDate(request.endDate)} ·{' '}
              {request.daysCount} jour{request.daysCount > 1 ? 's' : ''}
            </div>
          </div>
          <Button variant="solid" onClick={() => onSelect(request)}>
            Examiner
          </Button>
        </Card>
      ))}
    </div>
  );
}
