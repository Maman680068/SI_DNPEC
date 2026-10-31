'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { documentsACiter, type DocumentACiter } from '../../lib/api/communication';
import { motsTapes, surligner } from '../../lib/recherche/surligner';
import { IconeFichier } from '../ui/Charte';
import { messageChargement } from '../ui/ErreurChargement';

export interface DocumentChoisi {
  id: string;
  libelle: string;
}

/**
 * « Citer un document des Archives » : liste dès l'ouverture (documents déjà échangés avec ce
 * correspondant, puis récents de mon unité), filtrée à chaque lettre, sans accents, sur le titre et le
 * nom du fichier ; chaque résultat montre son emplacement et sa version. Seuls les documents que je
 * peux ouvrir sont proposés (droits des Archives, calculés par l'API).
 */
export function ChoixDocument({ avec, onChoisir, onFermer }: { avec: string; onChoisir: (d: DocumentChoisi) => void; onFermer: () => void }) {
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<DocumentACiter[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus(), []);
  useEffect(() => {
    let annule = false;
    const t = setTimeout(
      () =>
        documentsACiter(avec, q)
          .then((r) => {
            if (annule) return;
            setErreur(null);
            setResultats(r);
          })
          .catch((e) => !annule && setErreur(messageChargement(e))),
      q ? 60 : 0,
    );
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [q, avec]);
  const mots = motsTapes(q);

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-[10px] border border-line bg-surface p-3 shadow-[0_12px_30px_rgba(18,28,77,0.18)] sm:right-auto sm:w-[420px]"
      data-testid="choix-document"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onFermer();
        }
      }}
    >
      <label className="block text-[12.5px] font-semibold text-text">
        Citer un document des Archives
        <span className="mt-1.5 flex h-9 items-center gap-2 rounded-[9px] border border-line px-[11px] text-text-faint focus-within:border-ink">
          <Search aria-hidden size={15} />
          <input ref={champ} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre ou nom du fichier…" className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-normal text-text placeholder:text-text-faint focus:outline-none" />
        </span>
      </label>
      {erreur && <p className="mt-2 text-[12.5px] text-clay">{erreur}</p>}
      {resultats && resultats.length === 0 && (
        <p className="mt-2 text-[12.5px] text-text-muted">{q.trim() ? 'Aucun document que vous pouvez ouvrir ne correspond.' : 'Aucun document récent de votre unité ni déjà échangé : tapez un titre.'}</p>
      )}
      {resultats && resultats.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto" data-testid="documents-a-citer">
          {resultats.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onChoisir({ id: r.id, libelle: r.titre })} className="flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left text-[13px] hover:bg-bg" data-testid="document-a-citer">
                <IconeFichier nom={r.nomFichier ?? ''} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-text">{surligner(r.titre, mots)}</span>
                  <span className="block truncate text-[12px] text-text-muted">
                    {r.chemin}
                    {r.version ? ` · v${r.version}` : ''}
                    {r.echange ? ' · déjà échangé' : ''}
                  </span>
                </span>
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
