'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { EVENEMENT_MESSAGES_LUS, getAnnouncements, getContexteConversation, getConversations, getNombreMessagesNonLus } from '../../../lib/api/communication';
import { getPolls } from '../../../lib/api/polls';
import { getFils } from '../../../lib/api/pilotage';
import type { Announcement, ContexteConversation, Conversation } from '../../../lib/communication/types';
import type { Poll } from '../../../lib/polls/types';
import type { FilResume } from '../../../lib/pilotage/types';
import { ConversationList } from '../../../components/communication/ConversationList';
import { NewConversationSearch } from '../../../components/communication/NewConversationSearch';
import { useDemandeCreation } from '../../../lib/navigation/creer';
import { MessageThread } from '../../../components/communication/MessageThread';
import { FicheInterlocuteur } from '../../../components/communication/FicheInterlocuteur';
import { AnnouncementList } from '../../../components/communication/AnnouncementList';
import { AnnouncementDetailDrawer } from '../../../components/communication/AnnouncementDetailDrawer';
import { CreateAnnouncementModal } from '../../../components/communication/CreateAnnouncementModal';
import { PollList } from '../../../components/communication/PollList';
import { PollDetailDrawer } from '../../../components/communication/PollDetailDrawer';
import { CreatePollModal } from '../../../components/communication/CreatePollModal';
import { FilsDiscussion } from '../../../components/communication/FilsDiscussion';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { BTN_PRINCIPAL, EnTetePage, Onglets, Recherche, type Onglet } from '../../../components/ui/Charte';
import { estStagiaire } from '../../../lib/auth/stagiaire';

type Tab = 'messages' | 'fils' | 'announcements' | 'polls';

// Même ciblage cascade que les annonces (AnnouncementScope) : même ensemble de
// rôles peut créer l'un ou l'autre, voir PollsService.resolveAudienceAndAuthorize.
const CAN_ANNOUNCE_ROLES = ['DN', 'DNA', 'ADMIN_SYSTEME', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

/**
 * Communication (refonte de l'interface, étape 6, maquette validée) : onglets à compteur (messages non
 * lus, fils non lus, annonces, sondages sans réponse) ; messagerie en trois colonnes (conversations,
 * échange, fiche de l'interlocuteur) ; annonces et sondages en tableau compact avec fenêtre de détail.
 */
export default function CommunicationPage() {
  const { user: currentUser } = useAuth();
  // Stagiaire : messagerie et annonces seulement (les sondages lui sont fermés).
  const stagiaire = estStagiaire(currentUser?.role);
  const [tab, setTab] = useState<Tab>('messages');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [nonLus, setNonLus] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState('');
  const [chercheDestinataire, setChercheDestinataire] = useState(false);
  const [contexte, setContexte] = useState<ContexteConversation | null>(null);
  const [erreurContexte, setErreurContexte] = useState<string | null>(null);
  const [ficheOuverte, setFicheOuverte] = useState(false);
  const [filInitial, setFilInitial] = useState<string | null>(null);
  const [fils, setFils] = useState<FilResume[] | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);

  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  const loadConversations = useCallback(() => {
    getConversations().then(setConversations).catch((err) => setErreurChargement(messageChargement(err)));
    getNombreMessagesNonLus().then(setNonLus).catch(() => setNonLus(null));
  }, []);

  const loadAnnouncements = useCallback(() => {
    getAnnouncements().then(setAnnouncements).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  const loadPolls = useCallback(() => {
    getPolls().then(setPolls).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  // Compteur de l'onglet « Fils de discussion » (la liste elle-même est chargée par l'onglet).
  const loadFils = useCallback(() => {
    getFils().then(setFils).catch(() => setFils(null));
  }, []);

  useEffect(() => {
    loadConversations();
    loadAnnouncements();
    loadFils();
    if (!stagiaire) loadPolls();
  }, [loadConversations, loadAnnouncements, loadPolls, loadFils, stagiaire]);

  useEffect(() => {
    const maj = () => getNombreMessagesNonLus().then(setNonLus).catch(() => undefined);
    window.addEventListener(EVENEMENT_MESSAGES_LUS, maj);
    return () => window.removeEventListener(EVENEMENT_MESSAGES_LUS, maj);
  }, []);

  // Fiche de l'interlocuteur : documents cités et tâches en commun que le lecteur peut ouvrir.
  const loadContexte = useCallback((userId: string) => {
    setErreurContexte(null);
    getContexteConversation(userId)
      .then(setContexte)
      .catch((err) => setErreurContexte(messageChargement(err)));
  }, []);
  useEffect(() => {
    setContexte(null);
    setFicheOuverte(false);
    if (selectedUserId) loadContexte(selectedUserId);
  }, [selectedUserId, loadContexte]);

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

  // Menu « Créer » de la barre du haut (« /communication?nouveau=message ») : onglet Messages, curseur
  // dans la recherche d'un destinataire.
  const [nouveauMessage, setNouveauMessage] = useState(0);
  const ouvrirNouveauMessage = () => {
    setTab('messages');
    setSelectedUserId(null);
    setChercheDestinataire(true);
    setNouveauMessage((n) => n + 1);
  };
  useDemandeCreation('message', ouvrirNouveauMessage);

  const selectedAnnouncement = useMemo(() => announcements?.find((a) => a.id === selectedAnnouncementId) ?? null, [announcements, selectedAnnouncementId]);
  const selectedPoll = useMemo(() => polls?.find((p) => p.id === selectedPollId) ?? null, [polls, selectedPollId]);

  const canAnnounce = CAN_ANNOUNCE_ROLES.includes(currentUser?.role ?? '');

  const onglets: Onglet<Tab>[] = [
    { cle: 'messages', label: 'Messages', n: nonLus, chaud: true },
    { cle: 'fils', label: 'Fils de discussion', n: fils ? fils.filter((f) => f.nonLus > 0).length : null, chaud: true },
    { cle: 'announcements', label: 'Annonces', n: announcements?.length ?? null },
    ...(stagiaire ? [] : [{ cle: 'polls' as const, label: 'Sondages', n: polls ? polls.filter((p) => !p.isClosed && p.myOptionIds.length === 0).length : null, chaud: true }]),
  ];

  const boutonAnnonce = canAnnounce && (
    <button type="button" className={BTN_PRINCIPAL} onClick={() => setShowCreateAnnouncement(true)}>
      <Plus aria-hidden size={17} />
      Nouvelle annonce
    </button>
  );
  const boutonSondage = canAnnounce && (
    <button type="button" className={BTN_PRINCIPAL} onClick={() => setShowCreatePoll(true)}>
      <Plus aria-hidden size={17} />
      Nouveau sondage
    </button>
  );

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <EnTetePage titre="Communication" actions={tab === 'announcements' ? boutonAnnonce || undefined : tab === 'polls' ? boutonSondage || undefined : undefined} />
      <Onglets label="Rubriques de la communication" onglets={onglets} actif={tab} onChange={setTab} />

      {tab === 'fils' ? (
        // Joindre un objet passe par la recherche transverse, fermée aux stagiaires.
        <FilsDiscussion filInitial={filInitial} peutJoindre={!stagiaire} onChange={loadFils} />
      ) : tab === 'messages' ? (
        <div className="grid h-[calc(100vh-230px)] min-h-[480px] overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_260px]">
          {/* Sur téléphone, la liste et l'échange sont exclusifs (un seul panneau à la fois). */}
          <div className={`min-h-0 flex-col border-line md:flex md:border-r ${selectedUserId ? 'hidden' : 'flex'}`}>
            <div className="flex flex-col gap-2.5 border-b border-line p-3">
              {chercheDestinataire ? (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <NewConversationSearch
                      onPick={(id) => {
                        setSelectedUserId(id);
                        setChercheDestinataire(false);
                      }}
                      focus={nouveauMessage || 1}
                    />
                  </div>
                  <button type="button" onClick={() => setChercheDestinataire(false)} aria-label="Fermer la recherche d’un destinataire" className="grid h-9 w-9 flex-none place-items-center rounded-[9px] border border-line text-text-muted hover:bg-bg">
                    <X aria-hidden size={16} />
                  </button>
                </div>
              ) : (
                <Recherche value={filtre} onChange={setFiltre} placeholder="Rechercher…" label="Rechercher une conversation" />
              )}
              <button type="button" onClick={ouvrirNouveauMessage} className="flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-ink text-[13.5px] font-bold text-white hover:bg-ink-800">
                <Plus aria-hidden size={15} />
                Nouveau message
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations === null ? (
                <Chargement erreur={erreurChargement} className="px-4 py-6 text-center text-[13px] text-text-muted" />
              ) : (
                <ConversationList conversations={conversations} selectedUserId={selectedUserId} onSelect={setSelectedUserId} filtre={chercheDestinataire ? '' : filtre} />
              )}
            </div>
          </div>
          <div className={`min-h-0 min-w-0 ${selectedUserId ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
            {selectedUserId ? (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <MessageThread
                  otherUserId={selectedUserId}
                  onSent={loadConversations}
                  onBack={() => setSelectedUserId(null)}
                  contexte={contexte}
                  onContexteChange={() => loadContexte(selectedUserId)}
                  peutJoindre={!stagiaire}
                  onFiche={() => setFicheOuverte((o) => !o)}
                />
                {ficheOuverte && (
                  <div className="absolute inset-x-0 top-[61px] z-10 max-h-[70%] overflow-y-auto border-b border-line bg-surface shadow-[0_12px_30px_rgba(18,28,77,0.15)] xl:hidden">
                    <FicheInterlocuteur userId={selectedUserId} contexte={contexte} erreur={erreurContexte} />
                  </div>
                )}
              </div>
            ) : (
              <div className="m-auto max-w-[320px] px-6 text-center text-[13.5px] text-text-muted">
                Sélectionnez une conversation ou démarrez-en une avec « Nouveau message ».
              </div>
            )}
          </div>
          <div className="hidden min-h-0 overflow-y-auto border-l border-line xl:block">
            {selectedUserId ? (
              <FicheInterlocuteur userId={selectedUserId} contexte={contexte} erreur={erreurContexte} />
            ) : (
              <p className="px-4 py-6 text-center text-[12.5px] text-text-muted">La fiche de votre interlocuteur s’affiche ici.</p>
            )}
          </div>
        </div>
      ) : tab === 'announcements' ? (
        announcements === null ? (
          <Chargement erreur={erreurChargement} />
        ) : (
          <AnnouncementList announcements={announcements} onSelect={setSelectedAnnouncementId} vide={boutonAnnonce || undefined} />
        )
      ) : polls === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <PollList polls={polls} onSelect={setSelectedPollId} vide={boutonSondage || undefined} />
      )}

      {selectedAnnouncement && <AnnouncementDetailDrawer announcement={selectedAnnouncement} onClose={() => setSelectedAnnouncementId(null)} />}
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
