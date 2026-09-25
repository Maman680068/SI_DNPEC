'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { cancelMeeting, respondToMeeting } from '../../lib/api/meetings';
import type { Meeting } from '../../lib/meetings/types';
import { RESPONSE_STATUS_LABEL } from '../../lib/meetings/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { DecisionsSection } from './DecisionsSection';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function MeetingDetailDrawer({
  meeting,
  onClose,
  onUpdated,
}: {
  meeting: Meeting;
  onClose: () => void;
  onUpdated: (meeting: Meeting) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrganizer = meeting.createdById === currentUser?.id;
  const myParticipation = meeting.participants.find((p) => p.userId === currentUser?.id);
  const canRespond = !isOrganizer && myParticipation && meeting.status === 'PLANIFIEE';
  const canCancel = isOrganizer && meeting.status === 'PLANIFIEE';

  async function handleRespond(status: 'CONFIRME' | 'DECLINE') {
    setPending(true);
    setError(null);
    try {
      const updated = await respondToMeeting(meeting.id, status);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer votre réponse');
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Annuler cette réunion ? Les participants seront notifiés.')) return;
    setPending(true);
    setError(null);
    try {
      const updated = await cancelMeeting(meeting.id);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’annuler cette réunion');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(20,26,38,0.42)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-[92vw] overflow-y-auto bg-surface px-[26px] pb-10 pt-[26px] sm:w-[460px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {meeting.status === 'ANNULEE' && <Badge tone="clay">Annulée</Badge>}
            {isOrganizer && <Badge tone="gold">Vous êtes l’organisateur</Badge>}
          </div>
          <button onClick={onClose} className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        <h2 className="mb-1.5 text-[19px] font-semibold leading-snug">{meeting.title}</h2>
        <p className="mb-1 text-[13px] text-text-muted">{formatWhen(meeting.startAt)}</p>
        {meeting.location && <p className="mb-1 text-[13px] text-text-muted">📍 {meeting.location}</p>}
        {meeting.reservation?.statut === 'EN_ATTENTE' && (
          <p className="mb-1 text-[12.5px] text-text-muted">Salle « {meeting.reservation.ressource.nom} » en attente de validation par un gestionnaire.</p>
        )}
        {meeting.status === 'PLANIFIEE' && (meeting.reservation?.statut === 'ANNULEE_PRIORITE' || meeting.reservation?.statut === 'REFUSEE' || meeting.reservation?.statut === 'ANNULEE') && (
          <p className="mb-1 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay" data-testid="salle-perdue">
            Salle « {meeting.reservation.ressource.nom} » perdue
            {meeting.reservation.statut === 'ANNULEE_PRIORITE' ? ' (priorité hiérarchique)' : meeting.reservation.statut === 'REFUSEE' ? ' (refusée)' : ''} : la réunion n’a plus de salle.
          </p>
        )}
        <p className="mb-5 text-[12px] text-text-faint">
          Organisée par {isOrganizer ? 'vous' : getUserLabel(meeting.createdById)}
        </p>

        {meeting.status === 'ANNULEE' && meeting.cancellationReason && (
          <div className="mb-5 rounded-md bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay">
            Motif d’annulation : {meeting.cancellationReason}
          </div>
        )}

        {meeting.agenda && (
          <div className="mb-6">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">Ordre du jour</div>
            <div className="whitespace-pre-wrap rounded-md bg-bg p-3.5 text-[13.5px] leading-relaxed">{meeting.agenda}</div>
          </div>
        )}

        <div className="mb-6">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">
            Participants ({meeting.participants.length})
          </div>
          <ul className="space-y-1.5">
            {meeting.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-[13px]">
                <span>
                  {p.userId === currentUser?.id ? 'Vous' : getUserLabel(p.userId)}
                  {p.userId === meeting.createdById && <span className="ml-1.5 text-text-faint">(organisateur)</span>}
                </span>
                <Badge tone={p.responseStatus === 'CONFIRME' ? 'sage' : p.responseStatus === 'DECLINE' ? 'clay' : 'muted'}>
                  {RESPONSE_STATUS_LABEL[p.responseStatus]}
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        <DecisionsSection meetingId={meeting.id} />

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex flex-wrap gap-2.5">
          {canRespond && (
            <>
              <Button
                variant="solid"
                disabled={pending || myParticipation?.responseStatus === 'CONFIRME'}
                onClick={() => handleRespond('CONFIRME')}
              >
                Confirmer ma présence
              </Button>
              <Button
                variant="outline"
                disabled={pending || myParticipation?.responseStatus === 'DECLINE'}
                onClick={() => handleRespond('DECLINE')}
              >
                Décliner
              </Button>
            </>
          )}
          {canCancel && (
            <Button variant="outline" className="border-clay text-clay hover:bg-clay-soft" disabled={pending} onClick={handleCancel}>
              Annuler la réunion
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
