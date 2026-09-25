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

type Tab = 'mine' | 'validation';

export default function LeavesPage() {
  const { user: currentUser } = useAuth();
  const canValidate = LEADERSHIP_ROLES_FOR_LEAVES.includes(currentUser?.role ?? '');
  const [tab, setTab] = useState<Tab>('mine');

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceView[] | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedValidation, setSelectedValidation] = useState<LeaveRequest | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [linkHandled, setLinkHandled] = useState(false);

  const loadRequests = useCallback(() => {
    getLeaveRequests().then(setRequests);
  }, []);

  useEffect(() => {
    getLeaveTypes().then(setLeaveTypes);
    getMyBalances().then(setBalances);
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
    } else if (request.status === 'EN_ATTENTE' && canValidate) {
      setTab('validation');
      setSelectedValidation(request);
    } else {
      setLinkNotice('Cette demande de congé a déjà été traitée.');
    }
  }, [linkHandled, requests, currentUser, canValidate]);

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
    () => (requests ?? []).filter((r) => r.status === 'EN_ATTENTE' && r.userId !== currentUser?.id),
    [requests, currentUser?.id],
  );

  function handleRequestUpdated(updated: LeaveRequest) {
    setRequests((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
    // Une annulation (recrédit si déjà approuvée) ou une décision de validation change
    // le solde réel côté API — jamais reflété par la seule mise à jour de la demande.
    if (updated.userId === currentUser?.id) {
      getMyBalances().then(setBalances);
    }
  }

  function handleCreated(request: LeaveRequest) {
    setRequests((prev) => (prev ? [request, ...prev] : [request]));
    setShowCreateModal(false);
    getMyBalances().then(setBalances);
  }

  function handleDecided(updated: LeaveRequest) {
    handleRequestUpdated(updated);
    setSelectedValidation(null);
  }

  return (
    <div>
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

      {canValidate && (
        <div className="mb-4 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
          {(
            [
              { key: 'mine', label: 'Mes congés' },
              { key: 'validation', label: 'À valider' },
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
              {option.key === 'validation' && pendingForValidation.length > 0 && (
                <span className="ml-1.5 rounded-full bg-clay px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingForValidation.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'mine' ? (
        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold">Mon solde</h2>
            <select
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
            <p className="text-sm text-text-muted">Chargement…</p>
          ) : (
            <BalanceCards balances={balancesForYear} />
          )}

          <h2 className="mb-3.5 mt-[26px] text-[16px] font-extrabold">Mes demandes</h2>
          {requests === null ? (
            <p className="text-sm text-text-muted">Chargement…</p>
          ) : (
            <LeaveRequestList requests={myRequests} onChange={handleRequestUpdated} highlightId={highlightId} />
          )}
        </div>
      ) : requests === null ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <ValidationQueue requests={pendingForValidation} onSelect={setSelectedValidation} />
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
