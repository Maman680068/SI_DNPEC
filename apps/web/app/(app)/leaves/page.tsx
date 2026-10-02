'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getLeaveRequests, getLeaveTypes, getMyBalances } from '../../../lib/api/leaves';
import type { LeaveBalanceView, LeaveRequest, LeaveType } from '../../../lib/leaves/types';
import { LEADERSHIP_ROLES_FOR_LEAVES } from '../../../lib/leaves/types';
import { BalanceCards } from '../../../components/leaves/BalanceCards';
import { LeaveRequestList } from '../../../components/leaves/LeaveRequestList';
import { CreateLeaveRequestModal } from '../../../components/leaves/CreateLeaveRequestModal';
import { ValidationQueue } from '../../../components/leaves/ValidationQueue';
import { LeaveDecisionDrawer } from '../../../components/leaves/LeaveDecisionDrawer';
import { Button } from '../../../components/ui/Button';
import { JoursFeries } from '../../../components/leaves/JoursFeries';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Tab = 'mine' | 'validation' | 'suivi' | 'feries';

export default function LeavesPage() {
  const { user: currentUser } = useAuth();
  // Onglet « À traiter » : chefs (avis), DRH (décision) ; les droits par demande viennent de l'API.
  // Onglet « Suivi » : les autres demandes de son périmètre, en lecture (circuit, étape).
  const canValidate = LEADERSHIP_ROLES_FOR_LEAVES.includes(currentUser?.role ?? '') || (currentUser?.rolesFonctionnels ?? []).includes('DRH');
  const [tab, setTab] = useState<Tab>('mine');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceView[] | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedValidation, setSelectedValidation] = useState<LeaveRequest | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [linkHandled, setLinkHandled] = useState(false);
  const [anneeFeries, setAnneeFeries] = useState(new Date().getFullYear());

  // Calendrier des jours fériés (socle N3) : « /leaves?onglet=feries&annee=2027 » (alerte annuelle).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('onglet') === 'feries') {
      setTab('feries');
      const a = Number(params.get('annee'));
      if (a >= 2000 && a <= 2100) setAnneeFeries(a);
    }
  }, []);

  const loadRequests = useCallback(() => {
    getLeaveRequests().then(setRequests).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  useEffect(() => {
    getLeaveTypes().then(setLeaveTypes).catch((err) => setErreurChargement(messageChargement(err)));
    getMyBalances().then(setBalances).catch((err) => setErreurChargement(messageChargement(err)));
    loadRequests();
  }, [loadRequests]);

  // Lien d'email « /leaves?id=<id> », traité une fois les demandes chargées :
  // la sienne (approuvée/rejetée) → mise en évidence dans « Mes demandes » ;
  // celle d'un autre, en attente (soumise pour validation) → tiroir de décision.
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
    } else if (request.droits?.peutDonnerAvis || request.droits?.peutDecider) {
      setTab('validation');
      setSelectedValidation(request);
    } else {
      setTab('suivi');
      setSelectedValidation(request);
    }
  }, [linkHandled, requests, currentUser]);

  const availableYears = useMemo(() => {
    const years = new Set(balances?.map((b) => b.year) ?? []);
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [balances]);

  const balancesForYear = useMemo(() => balances?.filter((b) => b.year === year) ?? [], [balances, year]);

  const myRequests = useMemo(
    () => (requests ?? []).filter((r) => r.userId === currentUser?.id),
    [requests, currentUser?.id],
  );
  const pendingForValidation = useMemo(
    () => (requests ?? []).filter((r) => r.droits?.peutDonnerAvis || r.droits?.peutDecider),
    [requests],
  );
  const suivi = useMemo(
    () => (requests ?? []).filter((r) => r.userId !== currentUser?.id && !r.droits?.peutDonnerAvis && !r.droits?.peutDecider),
    [requests, currentUser?.id],
  );

  function handleRequestUpdated(updated: LeaveRequest) {
    setRequests((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
    // Une annulation (recrédit si déjà approuvée) ou une décision de validation change
    // le solde réel côté API — jamais reflété par la seule mise à jour de la demande.
    if (updated.userId === currentUser?.id) {
      getMyBalances().then(setBalances).catch((err) => setErreurChargement(messageChargement(err)));
    }
  }

  function handleCreated(request: LeaveRequest) {
    setRequests((prev) => (prev ? [request, ...prev] : [request]));
    setShowCreateModal(false);
    getMyBalances().then(setBalances).catch((err) => setErreurChargement(messageChargement(err)));
  }

  function handleDecided(updated: LeaveRequest) {
    handleRequestUpdated(updated);
    setSelectedValidation(null);
  }

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
          <h1 className="text-[22px] font-extrabold">Congés &amp; absences</h1>
        </div>
        {tab === 'mine' && (
          <Button variant="gold" onClick={() => setShowCreateModal(true)}>
            + Nouvelle demande
          </Button>
        )}
      </div>

      {linkNotice && <div className="mb-4 rounded-md bg-clay-soft px-4 py-3 text-sm text-clay">{linkNotice}</div>}

      <div role="tablist" className="mb-4 flex flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
          {(
            [
              { key: 'mine', label: 'Mes congés' },
              ...(canValidate
                ? ([
                    { key: 'validation', label: 'À traiter' },
                    { key: 'suivi', label: 'Suivi' },
                  ] as const)
                : []),
              { key: 'feries', label: 'Jours fériés' },
            ] as const
          ).map((option) => (
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
              {option.key === 'validation' && pendingForValidation.length > 0 && (
                <span className="ml-1.5 rounded-full bg-clay px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingForValidation.length}
                </span>
              )}
            </button>
          ))}
        </div>

      {tab === 'feries' ? (
        <JoursFeries anneeInitiale={anneeFeries} />
      ) : tab === 'mine' ? (
        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold">Mon solde</h2>
            <select
              aria-label="Année du solde"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px]"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {balances === null ? (
            <Chargement erreur={erreurChargement} />
          ) : (
            <BalanceCards balances={balancesForYear} />
          )}

          <h2 className="mb-3.5 mt-[26px] text-[16px] font-extrabold">Mes demandes</h2>
          {requests === null ? (
            <Chargement erreur={erreurChargement} />
          ) : (
            <LeaveRequestList requests={myRequests} onChange={handleRequestUpdated} highlightId={highlightId} />
          )}
        </div>
      ) : requests === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <ValidationQueue requests={tab === 'suivi' ? suivi : pendingForValidation} onSelect={setSelectedValidation} suivi={tab === 'suivi'} />
      )}

      {showCreateModal && (
        <CreateLeaveRequestModal leaveTypes={leaveTypes} onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
      )}
      {selectedValidation && (
        <LeaveDecisionDrawer
          request={selectedValidation}
          onClose={() => setSelectedValidation(null)}
          onDecided={handleDecided}
        />
      )}
    </div>
  );
}
