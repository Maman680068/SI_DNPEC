'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { searchUsers } from '../../lib/api/org';
import type { BasicUserInfo } from '../../lib/org/types';

export function NewConversationSearch({ onPick }: { onPick: (userId: string) => void }) {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BasicUserInfo[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsers(query).then((users) => {
        if (!cancelled) setResults(users.filter((u) => u.id !== currentUser?.id));
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentUser?.id]);

  return (
    <div className="relative border-b border-line p-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Nouvelle conversation — rechercher un nom…"
        className="w-full rounded-md border border-line bg-bg px-3 py-2 text-[12.5px] focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
      />
      {results.length > 0 && (
        <div className="absolute left-3 right-3 top-full z-10 mt-1 rounded-md border border-line bg-surface py-1 shadow-lg">
          {results.map((u) => (
            <button
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
              {u.jobTitle && <span className="ml-1.5 text-text-faint">· {u.jobTitle}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
