'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { searchUsers } from '../../lib/api/org';
import type { BasicUserInfo } from '../../lib/org/types';

/** `focus` : chaque nouvelle valeur (non nulle) place le curseur dans la recherche (menu « Créer »). */
export function NewConversationSearch({ onPick, focus = 0 }: { onPick: (userId: string) => void; focus?: number }) {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BasicUserInfo[]>([]);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) champ.current?.focus();
  }, [focus]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsers(query).then((users) => {
        if (!cancelled) setResults(users.filter((u) => u.id !== currentUser?.id));
      }).catch(() => {
        if (!cancelled) setResults([]);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentUser?.id]);

  return (
    <div className="relative">
      <input
        ref={champ}
        aria-label="Nouvelle conversation : rechercher un nom"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Destinataire — rechercher un nom…"
        className="h-9 w-full rounded-[9px] border border-ink bg-surface px-[11px] text-[13.5px] placeholder:text-text-faint focus:outline focus:outline-2 focus:outline-ink"
      />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-[9px] border border-line bg-surface py-1 shadow-lg">
          {results.map((u) => (
            <button
              type="button"
              key={u.id}
              onClick={() => {
                onPick(u.id);
                setQuery('');
                setResults([]);
              }}
              className="block w-full px-3 py-2 text-left text-[13px] hover:bg-bg"
            >
              <span className="font-semibold">
                {u.firstName} {u.lastName}
              </span>
              {u.jobTitle && <span className="ml-1.5 text-text-muted">· {u.jobTitle}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
