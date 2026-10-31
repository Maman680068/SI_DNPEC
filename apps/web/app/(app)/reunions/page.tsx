'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { getDecisionsASuivre, getDemandeReunion, getDemandesReunion, getMeetings } from '../../../lib/api/meetings';
import type { DecisionsASuivre as Decisions, DemandeReunion, DemandesReunion, Meeting } from '../../../lib/meetings/types';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { LigneReunion } from '../../../components/meetings/MeetingCard';
import { CreateMeetingModal } from '../../../components/meetings/CreateMeetingModal';
import { MeetingDetailDrawer } from '../../../components/meetings/MeetingDetailDrawer';
import { SemaineReunions } from '../../../components/meetings/SemaineReunions';
import { DecisionsASuivre } from '../../../components/meetings/DecisionsASuivre';
import { DemanderReunionModal, FenetreDemande, PanneauDemandes } from '../../../components/meetings/DemandesReunion';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { BTN_PRINCIPAL, EnTetePage, EtatVide, FiltreSelect, Filtres } from '../../../components/ui/Charte';
import { SquelettePage } from '../../../components/ui/Squelette';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { useDemandeCreation } from '../../../lib/navigation/creer';
import { semaineCourante } from '../../../lib/meetings/affichage';

type Filtre = 'toutes' | 'organisees' | 'invite';
type Periode = 'avenir' | 'passees';

/**
 * Réunions (refonte de l'interface, étape 6, maquette validée) : calendrier de la semaine, liste « À
 * venir » (filtre, réponse sur la ligne), « Décisions à suivre » ; fenêtre de réunion par ?id=.
 */
export default function ReunionsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decisions | null>(null);
  const [erreurDecisions, setErreurDecisions] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // S1 — droits (créer directement / demander) et demandes, calculés par l'API.
  const [demandes, setDemandes] = useState<DemandesReunion | null>(null);
  const [demander, setDemander] = useState(false);
  const [demandeOuverte, setDemandeOuverte] = useState<DemandeReunion | null>(null);
  const [demandeACreer, setDemandeACreer] = useState<DemandeReunion | null>(null);
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lundi, setLundi] = useState(semaineCourante);
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [periode, setPeriode] = useState<Periode>('avenir');

  const loadMeetings = useCallback(() => {
    getMeetings().then(setMeetings).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);
  const loadDecisions = useCallback(() => {
    getDecisionsASuivre()
      .then((d) => (setDecisions(d), setErreurDecisions(null)))
      .catch((err) => setErreurDecisions(messageChargement(err)));
  }, []);

  const loadDemandes = useCallback(() => {
    getDemandesReunion()
      .then(setDemandes)
      .catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  useEffect(() => {
    loadMeetings();
    loadDecisions();
    loadDemandes();
  }, [loadMeetings, loadDecisions, loadDemandes]);

  // Liens des notifications : « ?demande=<id> » (examiner, voir le motif), « &creer=1 » (créer la réunion
  // validée), « ?onglet=demandes » (À traiter du tableau de bord).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('demande');
    if (id)
      getDemandeReunion(id)
        .then((d) => (q.get('creer') === '1' && d.droits.creerReunion ? setDemandeACreer(d) : setDemandeOuverte(d)))
        .catch((e) => toast.erreur('Demande de réunion', messageErreur(e)));
    if (q.get('onglet') === 'demandes') setTimeout(() => document.getElementById('demandes-reunion')?.scrollIntoView({ block: 'start' }), 300);
  }, []);

  // Ouvre directement une réunion depuis un lien de notification
  // ("/reunions?id=<id>") — lu une seule fois au montage, comme le fait
  // déjà la page Communication pour "?with=".
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setSelectedId(id);
  }, []);

  // Menu « Créer » de la barre du haut (« /reunions?nouvelle=1 ») : créer, ou demander selon les droits.
  const [creationDemandee, setCreationDemandee] = useState(false);
  useDemandeCreation('reunion', () => setCreationDemandee(true));
  useEffect(() => {
    if (!creationDemandee || !demandes) return;
    setCreationDemandee(false);
    if (demandes.droits.creerReunion) setShowCreateModal(true);
    else if (demandes.droits.demanderReunion) setDemander(true);
  }, [creationDemandee, demandes]);

  const selected = meetings?.find((m) => m.id === selectedId) ?? null;

  const liste = useMemo(() => {
    if (!meetings) return [];
    const maintenant = Date.now();
    // « À venir » : jusqu'à la fin de la réunion (ou 2 h après son début, sans fin indiquée).
    const fin = (m: Meeting) => (m.endAt ? new Date(m.endAt).getTime() : new Date(m.startAt).getTime() + 2 * 3_600_000);
    return meetings
      .filter((m) => (periode === 'avenir' ? fin(m) >= maintenant : fin(m) < maintenant))
      .filter((m) => (filtre === 'organisees' ? m.createdById === user?.id : filtre === 'invite' ? m.createdById !== user?.id && m.participants.some((p) => p.userId === user?.id) : true))
      .sort((a, b) => (periode === 'avenir' ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt)));
  }, [meetings, filtre, periode, user?.id]);

  function handleCreated(meeting: Meeting) {
    setMeetings((prev) => (prev ? [meeting, ...prev] : [meeting]));
    setShowCreateModal(false);
    setDemandeACreer(null);
    loadDemandes();
  }

  function handleUpdated(updated: Meeting) {
    setMeetings((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev);
  }

  const boutonNouvelle = demandes?.droits.creerReunion ? (
    <button type="button" className={BTN_PRINCIPAL} onClick={() => setShowCreateModal(true)}>
      <Plus aria-hidden size={17} />
      Nouvelle réunion
    </button>
  ) : demandes?.droits.demanderReunion ? (
    <button type="button" className={BTN_PRINCIPAL} onClick={() => setDemander(true)}>
      <Plus aria-hidden size={17} />
      Demander une réunion
    </button>
  ) : null;

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <EnTetePage titre="Réunions" actions={boutonNouvelle} />

      {meetings === null ? (
        erreurChargement ? <Chargement erreur={erreurChargement} /> : <SquelettePage />
      ) : (
        <>
          {demandes && <PanneauDemandes aDecider={demandes.aDecider} miennes={demandes.miennes} onOuvrir={(d) => (d.droits.creerReunion ? setDemandeACreer(d) : setDemandeOuverte(d))} />}
          <SemaineReunions meetings={meetings} lundi={lundi} onLundi={setLundi} onOuvrir={setSelectedId} />
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
            <section aria-label={periode === 'avenir' ? 'À venir' : 'Réunions passées'} data-testid="liste-reunions" className="rounded-xl border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
                <h2 className="font-heading text-[15.5px] font-bold text-ink-900">{periode === 'avenir' ? 'À venir' : 'Réunions passées'}</h2>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Filtres
                    actifs={(periode !== 'avenir' ? 1 : 0) + (filtre !== 'toutes' ? 1 : 0)}
                    onEffacer={() => {
                      setPeriode('avenir');
                      setFiltre('toutes');
                    }}
                  >
                  <FiltreSelect<Periode> label="Période" value={periode} defaut="avenir" onChange={setPeriode} options={[{ value: 'avenir', label: 'À venir' }, { value: 'passees', label: 'Passées' }]} />
                  <FiltreSelect<Filtre>
                    label="Réunions affichées"
                    value={filtre}
                    defaut="toutes"
                    onChange={setFiltre}
                    options={[
                      { value: 'toutes', label: 'Toutes' },
                      { value: 'organisees', label: 'Organisées par moi' },
                      { value: 'invite', label: 'Où je suis invité' },
                    ]}
                  />
                  </Filtres>
                </div>
              </div>
              {liste.length === 0 ? (
                <div className="border-t border-line-doux">
                  <EtatVide texte={periode === 'avenir' ? 'Aucune réunion à venir.' : 'Aucune réunion passée.'} action={periode === 'avenir' ? boutonNouvelle : undefined} />
                </div>
              ) : (
                <ul>
                  {liste.map((meeting) => (
                    <LigneReunion key={meeting.id} meeting={meeting} onSelect={() => setSelectedId(meeting.id)} onUpdated={handleUpdated} />
                  ))}
                </ul>
              )}
            </section>
            <DecisionsASuivre donnees={decisions} erreur={erreurDecisions} onOuvrir={setSelectedId} />
          </div>
        </>
      )}

      {showCreateModal && <CreateMeetingModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
      {demandeACreer && <CreateMeetingModal demande={demandeACreer} onClose={() => setDemandeACreer(null)} onCreated={handleCreated} />}
      {demander && (
        <DemanderReunionModal
          onClose={() => setDemander(false)}
          onFait={() => {
            setDemander(false);
            loadDemandes();
          }}
        />
      )}
      {demandeOuverte && (
        <FenetreDemande
          demande={demandeOuverte}
          onClose={() => setDemandeOuverte(null)}
          onChange={loadDemandes}
          onCreer={(d) => {
            setDemandeOuverte(null);
            setDemandeACreer(d);
          }}
        />
      )}
      {selected && (
        <MeetingDetailDrawer
          meeting={selected}
          onClose={() => {
            setSelectedId(null);
            // Les décisions ont pu changer dans la fenêtre (ajout, conversion, clôture).
            loadDecisions();
          }}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
