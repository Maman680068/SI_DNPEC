'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { rechercherPersonnes, type PersonneTrouvee } from '../../lib/api/org';
import { motsTapes, surligner } from '../../lib/recherche/surligner';

const initiales = (p: PersonneTrouvee) => `${p.prenom.replace(/^TEST\s*[—–-]\s*/i, '').charAt(0)}${p.nom.charAt(0)}`.toUpperCase();

/**
 * Destinataire d'un nouveau message, « comme une messagerie » : dès le clic, correspondants récents puis
 * tout le personnel actif ; à chaque lettre, liste filtrée par l'API (sans accents, chaque mot dans prénom,
 * nom, fonction ou sigle d'unité ; débuts de mot en premier), lettres trouvées en gras. ↑ ↓ Entrée, Échap.
 * Choisir une personne avec qui une conversation existe l'ouvre. `focus` : chaque nouvelle valeur (non
 * nulle) place le curseur dans la recherche (menu « Créer »).
 */
export function NewConversationSearch({ onPick, focus = 0 }: { onPick: (userId: string) => void; focus?: number }) {
  const [query, setQuery] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [res, setRes] = useState<{ recents: PersonneTrouvee[]; personnes: PersonneTrouvee[] } | null>(null);
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const idListe = useId();
  useEffect(() => {
    if (focus) champ.current?.focus();
  }, [focus]);

  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    const minuteur = setTimeout(() => {
      rechercherPersonnes(query)
        .then((r) => {
          if (annule) return;
          setRes(r);
          setActif(0);
        })
        .catch(() => {
          if (!annule) setRes({ recents: [], personnes: [] });
        });
    }, query ? 60 : 0);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [query, ouvert]);

  const liste = res ? [...res.recents, ...res.personnes] : [];
  const mots = motsTapes(query);
  function choisir(p: PersonneTrouvee) {
    onPick(p.id);
    setQuery('');
    setOuvert(false);
    champ.current?.blur();
  }

  const ligne = (p: PersonneTrouvee, i: number) => (
    <li
      key={p.id}
      id={`${idListe}-${p.id}`}
      role="option"
      aria-selected={i === actif}
      data-testid="personne-trouvee"
      onMouseDown={(e) => {
        e.preventDefault();
        choisir(p);
      }}
      onMouseEnter={() => setActif(i)}
      className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${i === actif ? 'bg-ink-50' : ''}`}
    >
      <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full bg-ink-50 text-[11px] font-bold text-ink">
        {initiales(p)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-text">
          {surligner(`${p.prenom} ${p.nom}`, mots)}
        </span>
        <span className="block truncate text-[12px] text-text-muted">
          {p.fonction ? surligner(p.fonction, mots) : 'Fonction non renseignée'}
          {p.unite && <> · {surligner(p.unite, mots)}</>}
        </span>
      </span>
      {p.conversation && <span className="flex-none text-[11.5px] font-semibold text-text-muted">Conversation</span>}
    </li>
  );

  return (
    <div className="relative">
      <Search aria-hidden size={15} className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-text-faint" />
      <input
        ref={champ}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && liste[actif] ? `${idListe}-${liste[actif]!.id}` : undefined}
        aria-label="Nouvelle conversation : rechercher un nom"
        autoComplete="off"
        value={query}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOuvert(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOuvert(false);
            return;
          }
          if (!liste.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActif((a) => Math.min(a + 1, liste.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActif((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (liste[actif]) choisir(liste[actif]!);
          }
        }}
        placeholder="Destinataire — nom, fonction ou unité…"
        className="h-9 w-full rounded-[9px] border border-ink bg-surface pl-8 pr-[11px] text-[13.5px] placeholder:text-text-faint focus:outline focus:outline-2 focus:outline-ink"
      />
      {ouvert && res && (
        <ul id={idListe} role="listbox" aria-label="Destinataires possibles" className="absolute left-0 right-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-[0_12px_30px_rgba(18,28,77,0.18)]">
          {liste.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-text-muted">Aucune personne ne correspond.</li>
          ) : (
            <>
              {res.recents.length > 0 && (
                <li role="presentation" className="px-3 pb-1 pt-1.5 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
                  Récents
                </li>
              )}
              {res.recents.map((p, i) => ligne(p, i))}
              {res.recents.length > 0 && res.personnes.length > 0 && (
                <li role="presentation" className="px-3 pb-1 pt-2 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
                  Tout le personnel
                </li>
              )}
              {res.personnes.map((p, i) => ligne(p, res.recents.length + i))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
