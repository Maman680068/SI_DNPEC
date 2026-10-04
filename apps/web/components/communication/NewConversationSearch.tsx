'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { searchUsers } from '../../lib/api/org';
import type { BasicUserInfo } from '../../lib/org/types';

const initiales = (u: BasicUserInfo) => `${u.firstName.replace(/^TEST\s*[—–-]\s*/i, '').charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();

/**
 * Destinataire d'un nouveau message : recherche par nom côté API (messagerie sans restriction de
 * cascade), même présentation que le sélecteur de personnes des formulaires (liste de suggestions,
 * ↑ ↓ Entrée, Échap). `focus` : chaque nouvelle valeur (non nulle) place le curseur dans la recherche
 * (menu « Créer »).
 */
export function NewConversationSearch({ onPick, focus = 0 }: { onPick: (userId: string) => void; focus?: number }) {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BasicUserInfo[] | null>(null);
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const idListe = useId();
  useEffect(() => {
    if (focus) champ.current?.focus();
  }, [focus]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsers(query)
        .then((users) => {
          if (cancelled) return;
          setResults(users.filter((u) => u.id !== currentUser?.id));
          setActif(0);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentUser?.id]);

  function choisir(u: BasicUserInfo) {
    onPick(u.id);
    setQuery('');
    setResults(null);
  }
  const ouvert = results !== null;

  return (
    <div className="relative">
      <Search aria-hidden size={15} className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-text-faint" />
      <input
        ref={champ}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && results[actif] ? `${idListe}-${results[actif]!.id}` : undefined}
        aria-label="Nouvelle conversation : rechercher un nom"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (!results?.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActif((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActif((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[actif]) choisir(results[actif]!);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setResults(null);
          }
        }}
        placeholder="Destinataire — rechercher un nom…"
        className="h-9 w-full rounded-[9px] border border-ink bg-surface pl-8 pr-[11px] text-[13.5px] placeholder:text-text-faint focus:outline focus:outline-2 focus:outline-ink"
      />
      {ouvert && (
        <ul id={idListe} role="listbox" aria-label="Destinataires possibles" className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-[0_12px_30px_rgba(18,28,77,0.18)]">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-text-muted">Aucune personne ne correspond.</li>
          ) : (
            results.map((u, i) => (
              <li
                key={u.id}
                id={`${idListe}-${u.id}`}
                role="option"
                aria-selected={i === actif}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(u);
                }}
                onMouseEnter={() => setActif(i)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${i === actif ? 'bg-ink-50' : ''}`}
              >
                <span aria-hidden className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink-50 text-[10.5px] font-bold text-ink">
                  {initiales(u)}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">
                    {u.firstName} {u.lastName}
                  </b>
                  {u.jobTitle && <span className="block truncate text-[12px] text-text-muted">{u.jobTitle}</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
