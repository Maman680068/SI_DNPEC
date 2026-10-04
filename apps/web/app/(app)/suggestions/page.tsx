'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getAllSuggestions, getMySuggestions } from '../../../lib/api/suggestions';
import type { Suggestion, SuggestionStatus } from '../../../lib/suggestions/types';
import { STATUS_LABEL } from '../../../lib/suggestions/types';
import { MySuggestionList } from '../../../components/suggestions/MySuggestionList';
import { SuggestionInboxList } from '../../../components/suggestions/SuggestionInboxList';
import { SuggestionDecisionDrawer } from '../../../components/suggestions/SuggestionDecisionDrawer';
import { CreateSuggestionModal } from '../../../components/suggestions/CreateSuggestionModal';
import { Plus } from 'lucide-react';
import { BandeCompteurs, BarreOutils, BTN_PRINCIPAL, EnTetePage, Filtres, FiltreSelect, Onglets, Recherche } from '../../../components/ui/Charte';
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
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState<SuggestionStatus | ''>('');
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
  const selectedMine = useMemo(() => (selected ? null : (mine?.find((s) => s.id === selectedId) ?? null)), [mine, selected, selectedId]);

  function handleCreated(suggestion: Suggestion | null) {
    // null = soumise anonymement, n'apparaît pas dans "Mes suggestions" (voir SuggestionsService.findMine).
    if (suggestion) setMine((prev) => (prev ? [suggestion, ...prev] : [suggestion]));
    setShowCreateModal(false);
    if (isLeadership) loadInbox();
  }

  function handleUpdated(updated: Suggestion) {
    setInbox((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
    setMine((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
    setSelectedId(null);
  }

  const base = tab === 'mine' || !isLeadership ? mine : inbox;
  const n = (st: Suggestion['status']) => base?.filter((x) => x.status === st).length ?? 0;
  const q = recherche.trim().toLowerCase();
  const filtre = !!q || !!statut;
  const filtrer = (l: Suggestion[]) => l.filter((x) => (!statut || x.status === statut) && (!q || `${x.content} ${x.response ?? ''}`.toLowerCase().includes(q)));
  const effacer = () => (setRecherche(''), setStatut(''));

  return (
    <div>
      <EnTetePage
        titre="Boîte à suggestions"
        actions={
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setShowCreateModal(true)}>
            <Plus aria-hidden size={17} /> Nouvelle suggestion
          </button>
        }
      />
      <ErreurChargement message={erreurChargement} />

      {base && (
        <BandeCompteurs
          label="Suggestions par statut"
          items={[
            { valeur: n('RECUE'), label: 'Reçues', sous: isLeadership && tab === 'inbox' ? 'à examiner' : 'en attente de lecture', ton: isLeadership && tab === 'inbox' && n('RECUE') ? 'ambre' : 'encre' },
            { valeur: n('EN_ETUDE'), label: 'En étude', sous: 'par la Direction' },
            { valeur: n('RETENUE'), label: 'Retenues', ton: 'vert', sous: 'mises en œuvre' },
            { valeur: n('NON_RETENUE'), label: 'Non retenues', ton: 'gris', sous: 'avec réponse éventuelle' },
          ]}
        />
      )}

      {isLeadership && (
        <Onglets
          label="Suggestions"
          actif={tab}
          onChange={setTab}
          onglets={[
            { cle: 'inbox', label: 'Boîte de réception', n: inbox?.length ?? null, chaud: (inbox?.filter((x) => x.status === 'RECUE').length ?? 0) > 0 },
            { cle: 'mine', label: 'Mes suggestions', n: mine?.length ?? null },
          ]}
        />
      )}

      <BarreOutils>
        <Recherche value={recherche} onChange={setRecherche} placeholder="Rechercher dans les suggestions…" label="Rechercher une suggestion" />
        <Filtres actifs={statut ? 1 : 0} onEffacer={() => setStatut('')}>
          <FiltreSelect<SuggestionStatus | ''>
            label="Statut"
            value={statut}
            defaut=""
            onChange={setStatut}
            options={[{ value: '', label: 'Statut : tous' }, ...(['RECUE', 'EN_ETUDE', 'RETENUE', 'NON_RETENUE'] as const).map((st) => ({ value: st, label: STATUS_LABEL[st] }))]}
          />
        </Filtres>
      </BarreOutils>

      {tab === 'mine' || !isLeadership ? (
        mine === null ? (
          <Chargement erreur={erreurChargement} />
        ) : (
          <MySuggestionList suggestions={filtrer(mine)} onNouvelle={() => setShowCreateModal(true)} onSelect={setSelectedId} filtre={filtre} onEffacer={effacer} />
        )
      ) : inbox === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <SuggestionInboxList suggestions={filtrer(inbox)} onSelect={setSelectedId} selectedId={selectedId} filtre={filtre} onEffacer={effacer} />
      )}

      {showCreateModal && (
        <CreateSuggestionModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
      )}
      {selected && tab === 'inbox' && isLeadership ? (
        <SuggestionDecisionDrawer suggestion={selected} onClose={() => setSelectedId(null)} onUpdated={handleUpdated} />
      ) : (
        (selectedMine ?? selected) && <SuggestionDecisionDrawer suggestion={(selectedMine ?? selected)!} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
