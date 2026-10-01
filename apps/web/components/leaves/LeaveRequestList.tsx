'use client';

import { useEffect, useRef, useState } from 'react';
import { cancelLeaveRequest, deposerCertificat, telechargerCertificat } from '../../lib/api/leaves';
import type { LeaveRequest, LeaveRequestStatus } from '../../lib/leaves/types';
import { LIBELLE_AVIS, LIBELLE_ETAPE, STATUS_LABEL } from '../../lib/leaves/types';
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
  highlightId = null,
}: {
  requests: LeaveRequest[];
  onChange: (request: LeaveRequest) => void;
  /** Demande à mettre en évidence (lien d'email « /leaves?id=<id> »). */
  highlightId?: string | null;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'center' });
  }, [highlightId]);

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
        <div key={request.id} ref={request.id === highlightId ? highlightRef : undefined}>
          <Card className={`p-[18px] ${request.id === highlightId ? 'ring-2 ring-gold' : ''}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[14px] font-bold">{request.leaveType.name}</div>
              <Badge tone={STATUS_TONE[request.status]}>{request.etape ? LIBELLE_ETAPE[request.etape].toUpperCase() : STATUS_LABEL[request.status]}</Badge>
            </div>
            <div className="text-[13px] text-text-muted">
              Du {formatDate(request.startDate)} au {formatDate(request.endDate)} · {request.daysCount} jour
              {request.daysCount > 1 ? 's' : ''}
            </div>
            {request.reason && <p className="mt-1.5 text-[12.5px] text-text-faint">{request.reason}</p>}
            {request.etape === 'AVIS_ATTENDU' && request.avisEcheance && (
              <p className="mt-1.5 text-[12px] text-text-muted" data-testid="etape-conge">
                Votre chef donne son avis avant le {new Date(request.avisEcheance).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} ; sans avis, il sera réputé favorable. Le DRH décide ensuite.
              </p>
            )}
            {request.avisEtat && request.status === 'EN_ATTENTE' && (
              <p className="mt-1.5 text-[12px] text-text-muted" data-testid="etape-conge">
                {LIBELLE_AVIS[request.avisEtat]}{request.avisPar ? ` (${request.avisPar.nom})` : ''}. Décision du DRH attendue.
              </p>
            )}

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

            {(request.droits?.deposerCertificat || request.certificat) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]" data-testid="certificat-medical">
                {request.certificat ? (
                  <button type="button" className="text-ink underline" onClick={() => telechargerCertificat(request.id).catch((e) => setErreur(e instanceof Error ? e.message : String(e)))}>
                    📎 Certificat médical : {request.certificat.nom}
                  </button>
                ) : (
                  <span className="text-text-muted">Aucun certificat médical joint (visible de vous et du DRH seulement).</span>
                )}
                {request.droits?.deposerCertificat && (
                  <label className="cursor-pointer rounded-md border border-line px-2.5 py-1 font-semibold hover:bg-bg">
                    {request.certificat ? 'Remplacer le certificat' : 'Joindre le certificat médical'}
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setBusyId(request.id);
                        deposerCertificat(request.id, f)
                          .then(onChange)
                          .catch((err) => setErreur(err instanceof Error ? err.message : String(err)))
                          .finally(() => setBusyId(null));
                      }}
                    />
                  </label>
                )}
              </div>
            )}
            {erreur && <p className="mt-1.5 text-[12px] text-clay">{erreur}</p>}

            {(request.status === 'EN_ATTENTE' || request.status === 'APPROUVEE') && (
              <div className="mt-3">
                <Button variant="outline" disabled={busyId === request.id} onClick={() => handleCancel(request.id)}>
                  Annuler la demande
                </Button>
              </div>
            )}
          </Card>
        </div>
      ))}
    </div>
  );
}
