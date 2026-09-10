'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { closePoll, getPoll, votePoll } from '../../lib/api/polls';
import type { Poll } from '../../lib/polls/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

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
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(20,26,38,0.42)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-[92vw] overflow-y-auto bg-surface px-[26px] pb-10 pt-[26px] sm:w-[460px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {poll.isClosed && <Badge tone="clay">Clôturé</Badge>}
            {isAuthor && <Badge tone="gold">Vous êtes l’auteur</Badge>}
          </div>
          <button onClick={onClose} className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        <h2 className="mb-1.5 text-[19px] font-semibold leading-snug">{poll.question}</h2>
        <p className="mb-5 text-[12px] text-text-faint">
          Par {isAuthor ? 'vous' : getUserLabel(poll.authorId)} · {formatDateTime(poll.createdAt)}
          {poll.closesAt && !poll.isClosed && ` · clôture le ${formatDateTime(poll.closesAt)}`}
        </p>

        <div className="mb-2 text-[11px] text-text-faint">
          {poll.totalVoters} participant{poll.totalVoters > 1 ? 's' : ''}
          {poll.allowMultiple && ' · plusieurs choix possibles'}
        </div>

        <div className="mb-6 space-y-2.5">
          {poll.options.map((option) => {
            const percent = poll.totalVoters > 0 ? Math.round((option.voteCount / poll.totalVoters) * 100) : 0;
            const mine = poll.myOptionIds.includes(option.id);
            const voterNames = poll.canSeeDetail
              ? poll.voters?.filter((v) => v.optionId === option.id).map((v) => getUserLabel(v.userId))
              : undefined;

            return (
              <div key={option.id}>
                <button
                  type="button"
                  disabled={!canVote || voting}
                  onClick={() => (poll.allowMultiple ? toggleMultiple(option.id) : handleVoteSingle(option.id))}
                  className={`relative w-full overflow-hidden rounded-md border px-3.5 py-2.5 text-left text-[13.5px] disabled:cursor-default ${
                    mine ? 'border-accent' : 'border-line'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-accent-soft"
                    style={{ width: `${percent}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      {poll.allowMultiple && canVote && (
                        <input
                          type="checkbox"
                          checked={pendingSelection.includes(option.id)}
                          onChange={() => toggleMultiple(option.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      {option.label}
                      {mine && <span className="text-accent">✓</span>}
                    </span>
                    <span className="flex-shrink-0 text-text-muted">
                      {option.voteCount} · {percent}%
                    </span>
                  </div>
                </button>
                {voterNames && voterNames.length > 0 && (
                  <p className="mt-1 pl-3.5 text-[11px] text-text-faint">{voterNames.join(', ')}</p>
                )}
              </div>
            );
          })}
        </div>

        {poll.allowMultiple && canVote && (
          <Button variant="solid" disabled={voting || pendingSelection.length === 0} onClick={handleVoteMultiple} className="mb-4">
            {voting ? 'Envoi…' : poll.myOptionIds.length > 0 ? 'Mettre à jour mon vote' : 'Voter'}
          </Button>
        )}

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        {isAuthor && !poll.isClosed && (
          <Button variant="outline" className="border-clay text-clay hover:bg-clay-soft" disabled={closing} onClick={handleClose}>
            Clôturer le sondage
          </Button>
        )}
      </div>
    </div>
  );
}
