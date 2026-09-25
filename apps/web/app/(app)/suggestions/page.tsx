'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getAllSuggestions, getMySuggestions } from '../../../lib/api/suggestions';
import type { Suggestion } from '../../../lib/suggestions/types';
import { MySuggestionList } from '../../../components/suggestions/MySuggestionList';
import { SuggestionInboxList } from '../../../components/suggestions/SuggestionInboxList';
import { SuggestionDecisionDrawer } from '../../../components/suggestions/SuggestionDecisionDrawer';
import { CreateSuggestionModal } from '../../../components/suggestions/CreateSuggestionModal';
import { Button } from '../../../components/ui/Button';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Tab = 'mine' | 'inbox';

const LEADERSHIP_ROLES = ['DN', 'DNA'];

export default function SuggestionsPage() {
  const { user: currentUser } = useAuth();
  const isLeadership = LEADERSHIP_ROLES.includes(currentUser?.role ?? '');
  const [tab, setTab] = useState<Tab>(isLeadership ? 'inbox' : 'mine');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [mine, setMine] = useState<Suggestion[] | null>(null);
  const [inbox, setInbox] = useState<Suggestion[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadMine = useCallback(() => {
    getMySuggestions().then(setMine).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  const loadInbox = useCallback(() => {
    if (isLeadership) getAllSuggestions().then(setInbox).catch((err) => setErreurChargement(messageChargement(err)));
  }, [isLeadership]);

  useEffect(() => {
    loadMine();
    loadInbox();
  }, [loadMine, loadInbox]);

  const selected = useMemo(() => inbox?.find((s) => s.id === selectedId) ?? null, [inbox, selectedId]);

  function handleCreated(suggestion: Suggestion | null) {
    // null = soumise anonymement, n'apparaît pas dans "Mes suggestions" (voir SuggestionsService.findMine).
    if (suggestion) setMine((prev) => (prev ? [suggestion, ...prev] : [suggestion]));
    setShowCreateModal(false);
    if (isLeadership) loadInbox();
  }

  function handleUpdated(updated: Suggestion) {
    setInbox((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
    setSelectedId(null);
  }

  return (
    <div>
      <ErreurChargement message={erreurChargement} />
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
          <h1 className="text-[22px] font-extrabold">Boîte à suggestions</h1>
        </div>
        <Button variant="gold" onClick={() => setShowCreateModal(true)}>
          + Nouvelle suggestion
        </Button>
      </div>

      {isLeadership && (
        <div className="mb-4 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
          {(
            [
              { key: 'inbox', label: 'Boîte de réception' },
              { key: 'mine', label: 'Mes suggestions' },
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
      )}

      {tab === 'mine' || !isLeadership ? (
        mine === null ? (
          <Chargement erreur={erreurChargement} />
        ) : (
          <MySuggestionList suggestions={mine} />
        )
      ) : inbox === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <SuggestionInboxList suggestions={inbox} onSelect={setSelectedId} />
      )}

      {showCreateModal && (
        <CreateSuggestionModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
      )}
      {selected && (
        <SuggestionDecisionDrawer suggestion={selected} onClose={() => setSelectedId(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
