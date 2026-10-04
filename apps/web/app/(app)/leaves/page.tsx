'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getLeaveRequests, getLeaveTypes, getMyBalances } from '../../../lib/api/leaves';
import type { LeaveBalanceView, LeaveRequest, LeaveType } from '../../../lib/leaves/types';
import { LEADERSHIP_ROLES_FOR_LEAVES } from '../../../lib/leaves/types';
import { CreateLeaveRequestModal } from '../../../components/leaves/CreateLeaveRequestModal';
import { ValidationQueue } from '../../../components/leaves/ValidationQueue';
import { FenetreConge } from '../../../components/leaves/FenetreConge';
import { BoutonDemander, MesConges } from '../../../components/leaves/MesConges';
import { JoursFeries } from '../../../components/leaves/JoursFeries';
import { EnTetePage, Onglets, type Onglet } from '../../../components/ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { useDemandeCreation } from '../../../lib/navigation/creer';

type Tab = 'mine' | 'validation' | 'suivi' | 'feries';

export default function LeavesPage() {
  const { user: currentUser } = useAuth();
  // Onglet « À traiter » : chefs (avis), DRH (décision) ; les droits par demande viennent de l'API.
  // Onglet « Suivi de l'équipe » : les autres demandes de son périmètre, en lecture (circuit, étape).
  const canValidate = LEADERSHIP_ROLES_FOR_LEAVES.includes(currentUser?.role ?? '') || (currentUser?.rolesFonctionnels ?? []).includes('DRH');
  const [tab, setTab] = useState<Tab>('mine');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceView[] | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [linkHandled, setLinkHandled] = useState(false);
  const [anneeFeries, setAnneeFeries] = useState(new Date().getFullYear());

  // Calendrier des jours fériés (socle N3) : « /leaves?onglet=feries&annee=2027 » (alerte annuelle).
  // Tableau de bord (socle N6) : « /leaves?onglet=validation » (À traiter) et « /leaves?onglet=suivi » ;
  // l'onglet n'est affiché qu'à qui peut traiter des demandes, sinon « Mes congés » reste ouvert.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const onglet = params.get('onglet');
    if (onglet === 'feries') {
      setTab('feries');
      const a = Number(params.get('annee'));
      if (a >= 2000 && a <= 2100) setAnneeFeries(a);
    }
  }, []);

  useEffect(() => {
    const onglet = new URLSearchParams(window.location.search).get('onglet');
    if (canValidate && (onglet === 'validation' || onglet === 'suivi')) setTab(onglet);
  }, [canValidate]);

  // Menu « Créer » de la barre du haut (« /leaves?nouvelle=1 ») : « Mes congés », puis la demande.
  const demander = useCallback(() => {
    setTab('mine');
    setShowCreateModal(true);
  }, []);
  useDemandeCreation('conge', demander);

  const loadRequests = useCallback(() => {
    getLeaveRequests().then(setRequests).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);
  const loadBalances = useCallback(() => {
    getMyBalances().then(setBalances).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  useEffect(() => {
    getLeaveTypes().then(setLeaveTypes).catch((err) => setErreurChargement(messageChargement(err)));
    loadBalances();
    loadRequests();
  }, [loadRequests, loadBalances]);

  // Lien d'email « /leaves?id=<id> », traité une fois les demandes chargées : la sienne → « Mes
  // congés » et sa fenêtre ; celle d'un autre où l'on donne l'avis ou décide → « À traiter » ;
  // sinon → « Suivi de l'équipe », en consultation.
  useEffect(() => {
    if (linkHandled || requests === null || !currentUser) return;
    setLinkHandled(true);
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    const request = requests.find((r) => r.id === id);
    if (!request) {
      setLinkNotice('Cette demande de congé est introuvable ou hors de votre périmètre.');
    } else if (request.userId === currentUser.id) {
      setTab('mine');
      setHighlightId(id);
      setSelected(request);
    } else if (request.droits?.peutDonnerAvis || request.droits?.peutDecider) {
      setTab('validation');
      setSelected(request);
    } else {
      setTab('suivi');
      setSelected(request);
    }
  }, [linkHandled, requests, currentUser]);

  const availableYears = useMemo(() => {
    const years = new Set(balances?.map((b) => b.year) ?? []);
    for (const r of requests ?? []) if (r.userId === currentUser?.id) years.add(new Date(r.startDate).getUTCFullYear());
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [balances, requests, currentUser?.id]);

  const myRequests = useMemo(() => (requests === null ? null : requests.filter((r) => r.userId === currentUser?.id)), [requests, currentUser?.id]);
  const pendingForValidation = useMemo(() => (requests ?? []).filter((r) => r.droits?.peutDonnerAvis || r.droits?.peutDecider), [requests]);
  const suivi = useMemo(
    () => (requests ?? []).filter((r) => r.userId !== currentUser?.id && !r.droits?.peutDonnerAvis && !r.droits?.peutDecider),
    [requests, currentUser?.id],
  );

  function handleRequestUpdated(updated: LeaveRequest) {
    setRequests((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
    setSelected((s) => (s && s.id === updated.id ? updated : s));
    // Une annulation (recrédit si déjà approuvée) ou une décision change le solde réel côté API.
    if (updated.userId === currentUser?.id) loadBalances();
  }

  function handleCreated(request: LeaveRequest) {
    setRequests((prev) => (prev ? [request, ...prev] : [request]));
    setShowCreateModal(false);
    loadBalances();
  }

  function handleDecided(updated: LeaveRequest) {
    handleRequestUpdated(updated);
    setSelected(null);
  }

  const onglets: Onglet<Tab>[] = [
    { cle: 'mine', label: 'Mes congés' },
    ...(canValidate
      ? [
          { cle: 'validation' as const, label: 'À traiter', n: pendingForValidation.length, chaud: true },
          { cle: 'suivi' as const, label: 'Suivi de l’équipe' },
        ]
      : []),
    { cle: 'feries', label: 'Jours fériés' },
  ];

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <EnTetePage titre="Congés & absences" actions={<BoutonDemander onClick={demander} />} />

      {linkNotice && (
        <div role="status" className="mb-4 rounded-md bg-clay-soft px-4 py-3 text-sm text-clay">
          {linkNotice}
        </div>
      )}

      <Onglets label="Rubriques des congés" onglets={onglets} actif={tab} onChange={setTab} />

      {tab === 'feries' ? (
        <JoursFeries anneeInitiale={anneeFeries} />
      ) : tab === 'mine' ? (
        <MesConges
          requests={myRequests}
          balances={balances}
          year={year}
          years={availableYears}
          onYear={setYear}
          erreur={erreurChargement}
          highlightId={highlightId}
          onOpen={setSelected}
          onChange={handleRequestUpdated}
          onCreate={demander}
          onVoirFeries={() => {
            setAnneeFeries(new Date().getFullYear());
            setTab('feries');
          }}
        />
      ) : requests === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <ValidationQueue requests={tab === 'suivi' ? suivi : pendingForValidation} onSelect={setSelected} suivi={tab === 'suivi'} />
      )}

      {showCreateModal && <CreateLeaveRequestModal leaveTypes={leaveTypes} onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
      {selected && (
        <FenetreConge key={selected.id} request={selected} currentUserId={currentUser?.id} onClose={() => setSelected(null)} onDecided={handleDecided} onChange={handleRequestUpdated} />
      )}
    </div>
  );
}
