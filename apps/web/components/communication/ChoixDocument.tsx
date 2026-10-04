'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { rechercher } from '../../lib/api/pilotage';
import { messageChargement } from '../ui/ErreurChargement';

export interface DocumentChoisi {
  id: string;
  libelle: string;
}

/**
 * Trombone de la messagerie : choisir un document des Archives à citer. Passe par la recherche
 * transverse (catégorie « documents »), donc par les droits de l'auteur sur la GED.
 */
export function ChoixDocument({ onChoisir, onFermer }: { onChoisir: (d: DocumentChoisi) => void; onFermer: () => void }) {
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<DocumentChoisi[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 3) {
      setResultats(null);
      return;
    }
    let annule = false;
    const t = setTimeout(() => {
      rechercher(q.trim())
        .then((r) => {
          if (annule) return;
          setErreur(null);
          setResultats((r.categories.find((c) => c.cle === 'documents')?.resultats ?? []).map((x) => ({ id: x.id, libelle: x.libelle })));
        })
        .catch((e) => !annule && setErreur(messageChargement(e)));
    }, 300);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-[10px] border border-line bg-surface p-3 shadow-[0_12px_30px_rgba(18,28,77,0.18)] sm:right-auto sm:w-[380px]"
      data-testid="choix-document"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onFermer();
        }
      }}
    >
      <label className="block text-[12.5px] font-semibold text-text">
        Joindre un document des Archives
        <span className="mt-1.5 flex h-9 items-center gap-2 rounded-[9px] border border-line px-[11px] text-text-faint focus-within:border-ink">
          <Search aria-hidden size={15} />
          <input ref={champ} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre du document (3 caractères au moins)…" className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-normal text-text placeholder:text-text-faint focus:outline-none" />
        </span>
      </label>
      {erreur && <p className="mt-2 text-[12.5px] text-clay">{erreur}</p>}
      {resultats && resultats.length === 0 && <p className="mt-2 text-[12.5px] text-text-muted">Aucun document visible ne correspond.</p>}
      {resultats && resultats.length > 0 && (
        <ul className="mt-2 max-h-52 overflow-y-auto">
          {resultats.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onChoisir(r)} className="w-full rounded-[7px] px-2.5 py-1.5 text-left text-[13px] hover:bg-bg">
                {r.libelle}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={onFermer} className="text-[12.5px] font-semibold text-text-muted hover:text-ink">
          Fermer
        </button>
      </div>
    </div>
  );
}
