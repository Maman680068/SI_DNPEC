'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getAnnouncements, getConversations } from '../../../lib/api/communication';
import type { Announcement, Conversation } from '../../../lib/communication/types';
import { ConversationList } from '../../../components/communication/ConversationList';
import { NewConversationSearch } from '../../../components/communication/NewConversationSearch';
import { MessageThread } from '../../../components/communication/MessageThread';
import { AnnouncementList } from '../../../components/communication/AnnouncementList';
import { AnnouncementDetailDrawer } from '../../../components/communication/AnnouncementDetailDrawer';
import { CreateAnnouncementModal } from '../../../components/communication/CreateAnnouncementModal';
import { Button } from '../../../components/ui/Button';

type Tab = 'messages' | 'announcements';

const CAN_ANNOUNCE_ROLES = ['DN', 'DNA', 'ADMIN_SYSTEME', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

export default function CommunicationPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('messages');

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);

  const loadConversations = useCallback(() => {
    getConversations().then(setConversations);
  }, []);

  const loadAnnouncements = useCallback(() => {
    getAnnouncements().then(setAnnouncements);
  }, []);

  useEffect(() => {
    loadConversations();
    loadAnnouncements();
  }, [loadConversations, loadAnnouncements]);

  // Ouvre directement une conversation depuis un lien externe (ex. la fiche d'une
  // personne dans l'Annuaire, "/communication?with=<id>") — lu une seule fois au
  // montage via window.location plutôt que useSearchParams, qui exigerait
  // d'englober la page dans un Suspense pour rien : cette page est de toute façon
  // entièrement pilotée côté client, la réactivité aux changements d'URL une fois
  // montée n'est pas nécessaire ici.
  useEffect(() => {
    const withId = new URLSearchParams(window.location.search).get('with');
    if (withId) setSelectedUserId(withId);
  }, []);

  const selectedAnnouncement = useMemo(
    () => announcements?.find((a) => a.id === selectedAnnouncementId) ?? null,
    [announcements, selectedAnnouncementId],
  );

  const canAnnounce = CAN_ANNOUNCE_ROLES.includes(currentUser?.role ?? '');

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Communication</div>
          <h1 className="text-[22px] font-extrabold">Messagerie &amp; annonces</h1>
        </div>
        {tab === 'announcements' && canAnnounce && (
          <Button variant="gold" onClick={() => setShowCreateAnnouncement(true)}>
            + Nouvelle annonce
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            { key: 'messages', label: 'Messagerie' },
            { key: 'announcements', label: 'Annonces' },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            onClick={() => setTab(option.key)}
            className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${
              tab === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'messages' ? (
        <div className="flex h-[calc(100vh-260px)] min-h-[420px] overflow-hidden rounded-lg border border-line bg-surface">
          {/* Sur mobile, la liste et le fil sont mutuellement exclusifs (un seul
           * panneau plein écran à la fois) — les deux côte à côte comme sur
           * desktop n'y laisseraient que quelques dizaines de pixels au fil. */}
          <div
            className={`w-full flex-shrink-0 overflow-y-auto border-r border-line md:block md:w-[300px] ${
              selectedUserId ? 'hidden' : ''
            }`}
          >
            <NewConversationSearch onPick={setSelectedUserId} />
            {conversations === null ? (
              <p className="px-4 py-6 text-center text-[13px] text-text-muted">Chargement…</p>
            ) : (
              <ConversationList conversations={conversations} selectedUserId={selectedUserId} onSelect={setSelectedUserId} />
            )}
          </div>
          <div className={`flex-1 ${selectedUserId ? '' : 'hidden md:block'}`}>
            {selectedUserId ? (
              <MessageThread
                otherUserId={selectedUserId}
                onSent={loadConversations}
                onBack={() => setSelectedUserId(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-text-faint">
                Sélectionnez une conversation ou démarrez-en une nouvelle.
              </div>
            )}
          </div>
        </div>
      ) : announcements === null ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <AnnouncementList announcements={announcements} onSelect={setSelectedAnnouncementId} />
      )}

      {selectedAnnouncement && (
        <AnnouncementDetailDrawer announcement={selectedAnnouncement} onClose={() => setSelectedAnnouncementId(null)} />
      )}
      {showCreateAnnouncement && (
        <CreateAnnouncementModal
          onClose={() => setShowCreateAnnouncement(false)}
          onCreated={(announcement) => {
            setAnnouncements((prev) => (prev ? [announcement, ...prev] : [announcement]));
            setShowCreateAnnouncement(false);
          }}
        />
      )}
    </div>
  );
}
