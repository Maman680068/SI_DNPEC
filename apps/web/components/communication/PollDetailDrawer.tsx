'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { closePoll, getPoll, votePoll } from '../../lib/api/polls';
import type { Poll } from '../../lib/polls/types';
import { Check } from 'lucide-react';
import { BTN_DANGER_CONTOUR, BTN_PRINCIPAL, CleValeur, Pastille, SectionFenetre } from '../ui/Charte';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { FenetreDetail } from '../ui/FenetreDetail';

// Pas d'infrastructure temps réel dans le projet (ni WebSocket ni SSE) — un
// rafraîchissement léger toutes les 15s tant que le tiroir reste ouvert donne
// une impression de suivi en direct sans nouvelle dépendance, comme convenu.
const REFRESH_INTERVAL_MS = 15_000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function PollDetailDrawer({
  poll,
  onClose,
  onUpdated,
}: {
  poll: Poll;
  onClose: () => void;
  onUpdated: (poll: Poll) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  const [pendingSelection, setPendingSelection] = useState<string[]>(poll.myOptionIds);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthor = poll.authorId === currentUser?.id;
  const canVote = !poll.isClosed;

  // Rafraîchissement périodique des résultats tant que le tiroir reste ouvert.
  useEffect(() => {
    const timer = setInterval(() => {
      getPoll(poll.id).then(onUpdated).catch(() => undefined);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [poll.id]);

  async function handleVoteSingle(optionId: string) {
    if (!canVote || voting) return;
    setVoting(true);
    setError(null);
    try {
      const updated = await votePoll(poll.id, [optionId]);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer votre vote');
    } finally {
      setVoting(false);
    }
  }

  async function handleVoteMultiple() {
    if (pendingSelection.length === 0) return;
    setVoting(true);
    setError(null);
    try {
      const updated = await votePoll(poll.id, pendingSelection);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer votre vote');
    } finally {
      setVoting(false);
    }
  }

  function toggleMultiple(optionId: string) {
    setPendingSelection((prev) => (prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]));
  }

  async function handleClose() {
    if (!window.confirm('Clôturer ce sondage ? Plus personne ne pourra voter ensuite.')) return;
    setClosing(true);
    setError(null);
    try {
      const updated = await closePoll(poll.id);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de clôturer ce sondage');
    } finally {
      setClosing(false);
    }
  }

  return (
    <FenetreDetail
      titre={poll.question}
      onClose={onClose}
      largeur={860}
      filAriane={['Communication', 'Sondages']}
      testid="fenetre-sondage"
      cote={
        <>
          <SectionFenetre titre="Actions">
            {error && <div role="alert" className="mb-3 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}
            <div className="flex flex-col gap-2">
              {poll.allowMultiple && canVote && (
                <button type="button" className={BTN_PRINCIPAL} disabled={voting || pendingSelection.length === 0} onClick={handleVoteMultiple}>
                  {voting ? 'Envoi…' : poll.myOptionIds.length > 0 ? 'Mettre à jour mon vote' : 'Voter'}
                </button>
              )}
              {isAuthor && !poll.isClosed && (
                <button type="button" className={BTN_DANGER_CONTOUR} disabled={closing} onClick={handleClose}>
                  Clôturer le sondage
                </button>
              )}
              {!(poll.allowMultiple && canVote) && !(isAuthor && !poll.isClosed) && (
                <p className="text-[12.5px] text-text-muted">{poll.isClosed ? 'Sondage clôturé : plus de vote possible.' : 'Cliquez sur un choix pour voter.'}</p>
              )}
            </div>
          </SectionFenetre>
          <SectionFenetre titre="Informations" className="mb-0">
            <CleValeur
              largeur={96}
              lignes={[
                ['État', poll.isClosed ? <Pastille key="e" ton="gris">Clôturé</Pastille> : poll.myOptionIds.length > 0 ? <Pastille key="e" ton="vert">Vous avez voté</Pastille> : <Pastille key="e" ton="ambre">À répondre</Pastille>],
                ['Portée', SCOPE_LABEL[poll.scope]],
                ['Auteur', isAuthor ? 'Vous' : getUserLabel(poll.authorId)],
                ['Créé le', formatDateTime(poll.createdAt)],
                ...(poll.closesAt && !poll.isClosed ? ([['Clôture le', formatDateTime(poll.closesAt)]] as [string, string][]) : []),
                ['Participants', String(poll.totalVoters)],
                ['Choix', poll.allowMultiple ? 'Plusieurs choix possibles' : 'Un seul choix'],
              ]}
            />
          </SectionFenetre>
        </>
      }
    >
      <SectionFenetre titre="Résultats" n={poll.totalVoters} className="mb-0">
        <div className="space-y-2.5">
          {poll.options.map((option) => {
            const percent = poll.totalVoters > 0 ? Math.round((option.voteCount / poll.totalVoters) * 100) : 0;
            const mine = poll.myOptionIds.includes(option.id);
            const voterNames = poll.canSeeDetail
              ? poll.voters?.filter((v) => v.optionId === option.id).map((v) => getUserLabel(v.userId))
              : undefined;

            return (
              <div key={option.id}>
                {(() => {
                  const contenu = (
                    <>
                      <div className="absolute inset-y-0 left-0 bg-ink-50" style={{ width: `${percent}%` }} aria-hidden />
                      <div className="relative flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium">
                          {poll.allowMultiple && canVote && (
                            <input type="checkbox" checked={pendingSelection.includes(option.id)} onChange={() => toggleMultiple(option.id)} disabled={voting} />
                          )}
                          {option.label}
                          {mine && (
                            <>
                              <Check aria-hidden size={15} className="text-ink" />
                              <span className="sr-only">(votre choix)</span>
                            </>
                          )}
                        </span>
                        <span className="flex-shrink-0 text-text-muted">
                          {option.voteCount} · {percent}%
                        </span>
                      </div>
                    </>
                  );
                  const classe = `relative block w-full overflow-hidden rounded-[10px] border px-3.5 py-2.5 text-left text-[13.5px] ${mine ? 'border-ink' : 'border-line'}`;
                  // Choix multiple : une case à cocher par choix (pas de case dans un bouton) ; choix unique : un clic vote.
                  return poll.allowMultiple && canVote ? (
                    <label data-testid="option-sondage" className={`${classe} cursor-pointer`}>
                      {contenu}
                    </label>
                  ) : (
                    <button type="button" data-testid="option-sondage" disabled={!canVote || voting} aria-pressed={mine} onClick={() => handleVoteSingle(option.id)} className={`${classe} disabled:cursor-default`}>
                      {contenu}
                    </button>
                  );
                })()}
                {voterNames && voterNames.length > 0 && <p className="mt-1 pl-3.5 text-[12px] text-text-muted">{voterNames.join(', ')}</p>}
              </div>
            );
          })}
        </div>
      </SectionFenetre>
    </FenetreDetail>
  );
}
