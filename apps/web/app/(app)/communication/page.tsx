'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getAnnouncements, getConversations } from '../../../lib/api/communication';
import { getPolls } from '../../../lib/api/polls';
import type { Announcement, Conversation } from '../../../lib/communication/types';
import type { Poll } from '../../../lib/polls/types';
import { ConversationList } from '../../../components/communication/ConversationList';
import { NewConversationSearch } from '../../../components/communication/NewConversationSearch';
import { MessageThread } from '../../../components/communication/MessageThread';
import { AnnouncementList } from '../../../components/communication/AnnouncementList';
import { AnnouncementDetailDrawer } from '../../../components/communication/AnnouncementDetailDrawer';
import { CreateAnnouncementModal } from '../../../components/communication/CreateAnnouncementModal';
import { PollList } from '../../../components/communication/PollList';
import { PollDetailDrawer } from '../../../components/communication/PollDetailDrawer';
import { CreatePollModal } from '../../../components/communication/CreatePollModal';
import { Button } from '../../../components/ui/Button';
import { FilsDiscussion } from '../../../components/communication/FilsDiscussion';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { estStagiaire } from '../../../lib/auth/stagiaire';

type Tab = 'messages' | 'fils' | 'announcements' | 'polls';

// Même ciblage cascade que les annonces (AnnouncementScope) : même ensemble de
// rôles peut créer l'un ou l'autre, voir PollsService.resolveAudienceAndAuthorize.
const CAN_ANNOUNCE_ROLES = ['DN', 'DNA', 'ADMIN_SYSTEME', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

export default function CommunicationPage() {
  const { user: currentUser } = useAuth();
  // Stagiaire : messagerie et annonces seulement (les sondages lui sont fermés).
  const stagiaire = estStagiaire(currentUser?.role);
  const [tab, setTab] = useState<Tab>('messages');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filInitial, setFilInitial] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);

  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  const loadConversations = useCallback(() => {
    getConversations().then(setConversations).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  const loadAnnouncements = useCallback(() => {
    getAnnouncements().then(setAnnouncements).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  const loadPolls = useCallback(() => {
    getPolls().then(setPolls).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  useEffect(() => {
    loadConversations();
    loadAnnouncements();
    if (!stagiaire) loadPolls();
  }, [loadConversations, loadAnnouncements, loadPolls, stagiaire]);

  // Ouvre directement une conversation depuis un lien externe (ex. la fiche d'une
  // personne dans l'Annuaire, "/communication?with=<id>") — lu une seule fois au
  // montage via window.location plutôt que useSearchParams, qui exigerait
  // d'englober la page dans un Suspense pour rien : cette page est de toute façon
  // entièrement pilotée côté client, la réactivité aux changements d'URL une fois
  // montée n'est pas nécessaire ici.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const withId = params.get('with');
    if (withId) setSelectedUserId(withId);
    // Socle N5 : lien des notifications de fil (« /communication?fil=<id> »).
    const fil = params.get('fil');
    if (fil) {
      setTab('fils');
      setFilInitial(fil);
    }
    const pollId = params.get('pollId');
    if (pollId) {
      setTab('polls');
      setSelectedPollId(pollId);
    }
    // Lien de l'email de notification d'annonce (« /communication?announcementId=<id> »).
    const announcementId = params.get('announcementId');
    if (announcementId) {
      setTab('announcements');
      setSelectedAnnouncementId(announcementId);
    }
  }, []);

  const selectedAnnouncement = useMemo(
    () => announcements?.find((a) => a.id === selectedAnnouncementId) ?? null,
    [announcements, selectedAnnouncementId],
  );

  const selectedPoll = useMemo(() => polls?.find((p) => p.id === selectedPollId) ?? null, [polls, selectedPollId]);

  const canAnnounce = CAN_ANNOUNCE_ROLES.includes(currentUser?.role ?? '');

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
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
        {tab === 'polls' && canAnnounce && (
          <Button variant="gold" onClick={() => setShowCreatePoll(true)}>
            + Nouveau sondage
          </Button>
        )}
      </div>

      <div role="tablist" className="mb-4 flex flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            { key: 'messages', label: 'Messagerie' },
            { key: 'fils', label: 'Fils de discussion' },
            { key: 'announcements', label: 'Annonces' },
            { key: 'polls', label: 'Sondages' },
          ] as const
        ).filter((option) => !stagiaire || option.key !== 'polls').map((option) => (
          <button
            key={option.key}
            role="tab"
            aria-selected={tab === option.key}
            onClick={() => setTab(option.key)}
            className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${
              tab === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'fils' ? (
        // Joindre un objet passe par la recherche transverse, fermée aux stagiaires.
        <FilsDiscussion filInitial={filInitial} peutJoindre={!stagiaire} />
      ) : tab === 'messages' ? (
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
              <Chargement erreur={erreurChargement} className="px-4 py-6 text-center text-[13px] text-text-muted" />
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
      ) : tab === 'announcements' ? (
        announcements === null ? (
          <Chargement erreur={erreurChargement} />
        ) : (
          <AnnouncementList announcements={announcements} onSelect={setSelectedAnnouncementId} />
        )
      ) : polls === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <PollList polls={polls} onSelect={setSelectedPollId} />
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

      {selectedPoll && (
        <PollDetailDrawer
          poll={selectedPoll}
          onClose={() => setSelectedPollId(null)}
          onUpdated={(updated) => setPolls((prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? prev)}
        />
      )}
      {showCreatePoll && (
        <CreatePollModal
          onClose={() => setShowCreatePoll(false)}
          onCreated={(poll) => {
            setPolls((prev) => (prev ? [poll, ...prev] : [poll]));
            setShowCreatePoll(false);
          }}
        />
      )}
    </div>
  );
}
