'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMeetings } from '../../../lib/api/meetings';
import type { Meeting } from '../../../lib/meetings/types';
import { MeetingCard } from '../../../components/meetings/MeetingCard';
import { CreateMeetingModal } from '../../../components/meetings/CreateMeetingModal';
import { MeetingDetailDrawer } from '../../../components/meetings/MeetingDetailDrawer';
import { Button } from '../../../components/ui/Button';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

export default function ReunionsPage() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadMeetings = useCallback(() => {
    getMeetings().then(setMeetings).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Ouvre directement une réunion depuis un lien de notification
  // ("/reunions?id=<id>") — lu une seule fois au montage, comme le fait
  // déjà la page Communication pour "?with=".
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setSelectedId(id);
  }, []);

  const selected = meetings?.find((m) => m.id === selectedId) ?? null;

  function handleCreated(meeting: Meeting) {
    setMeetings((prev) => (prev ? [meeting, ...prev] : [meeting]));
    setShowCreateModal(false);
  }

  function handleUpdated(updated: Meeting) {
    setMeetings((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev);
  }

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
          <h1 className="text-[22px] font-extrabold">Réunions</h1>
        </div>
        <Button variant="gold" onClick={() => setShowCreateModal(true)}>
          + Nouvelle réunion
        </Button>
      </div>

      {meetings === null ? (
        <Chargement erreur={erreurChargement} />
      ) : meetings.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">Aucune réunion pour l’instant.</p>
      ) : (
        <div className="space-y-2.5">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} onSelect={() => setSelectedId(meeting.id)} />
          ))}
        </div>
      )}

      {showCreateModal && <CreateMeetingModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
      {selected && (
        <MeetingDetailDrawer meeting={selected} onClose={() => setSelectedId(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
