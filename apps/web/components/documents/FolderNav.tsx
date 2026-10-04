'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Folder as IconeDossier, Plus } from 'lucide-react';
import { createFolder } from '../../lib/api/documents';
import type { Folder } from '../../lib/documents/types';

export interface FolderNavHandle {
  /** Ouvre la saisie d'un nouveau dossier (bouton « Nouveau dossier » de l'en-tête). */
  nouveauDossier: () => void;
}

/**
 * Arborescence des dossiers de l'espace d'une division (230 px à gauche du tableau) : « Tous les
 * documents », dossiers et sous-dossiers indentés avec leur nombre de documents (sous-dossiers compris), « + Nouveau dossier »
 * (créé dans le dossier ouvert). `dossiers` nul : liste non consultable (message de l'API).
 */
export const FolderNav = forwardRef<
  FolderNavHandle,
  {
    divisionId: string | null;
    dossiers: Folder[] | null;
    erreur: string | null;
    compteurs: Map<string, number>;
    total: number;
    currentFolderId: string | null;
    onNavigate: (folderId: string | null) => void;
    onCreated: (folder: Folder) => void;
  }
>(function FolderNav({ divisionId, dossiers, erreur, compteurs, total, currentFolderId, onNavigate, onCreated }, ref) {
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    nouveauDossier: () => {
      setCreation(true);
      setTimeout(() => champ.current?.focus(), 0);
    },
  }));

  const parent = dossiers?.find((f) => f.id === currentFolderId) ?? null;

  async function creer() {
    if (!nom.trim() || !divisionId) return;
    setBusy(true);
    setErreurCreation(null);
    try {
      const cree = await createFolder({ name: nom.trim(), divisionId, parentFolderId: currentFolderId ?? undefined });
      onCreated(cree);
      setNom('');
      setCreation(false);
    } catch (err) {
      setErreurCreation(err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  }

  // Dossiers dans l'ordre de l'arbre (parents puis enfants), avec leur profondeur.
  const lignes: { f: Folder; niveau: number }[] = [];
  const enfants = (parentId: string | null, niveau: number, vus: Set<string>) => {
    for (const f of (dossiers ?? []).filter((x) => x.parentFolderId === parentId)) {
      if (vus.has(f.id)) continue;
      vus.add(f.id);
      lignes.push({ f, niveau });
      enfants(f.id, niveau + 1, vus);
    }
  };
  enfants(null, 0, new Set());

  const ligne = (id: string | null, libelle: string, n: number, niveau = 0) => {
    const on = currentFolderId === id;
    return (
      <li key={id ?? 'tous'}>
        <button
          type="button"
          onClick={() => onNavigate(id)}
          aria-current={on ? 'true' : undefined}
          className={`flex min-h-[34px] w-full items-center gap-[9px] rounded-lg py-1.5 pr-2 text-left text-[13.5px] ${on ? 'bg-ink-50 font-semibold text-ink' : 'font-medium text-text hover:bg-bg'}`}
          style={{ paddingLeft: 8 + niveau * 18 }}
        >
          <IconeDossier aria-hidden size={niveau ? 15 : 16} className={`flex-none ${on ? 'text-ink' : 'text-[#8A90A6]'}`} />
          <span className="min-w-0 flex-1 leading-tight">{libelle}</span>
          <span className="flex-none text-[12px] font-semibold text-text-muted">
            {n}
            <span className="sr-only"> document{n > 1 ? 's' : ''}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="Dossiers" className="rounded-xl border border-line bg-surface p-2.5" data-testid="arborescence-dossiers">
      <h2 className="px-2 py-1.5 text-[12px] font-bold text-text-muted">Dossiers</h2>
      <ul className="space-y-0.5">
        {ligne(null, 'Tous les documents', total)}
        {lignes.map(({ f, niveau }) => ligne(f.id, f.name, compteurs.get(f.id) ?? 0, niveau))}
      </ul>
      {erreur && <p className="px-2 py-1.5 text-[12.5px] text-text-muted">{erreur}</p>}
      {dossiers === null && !erreur && <p className="px-2 py-1.5 text-[12.5px] text-text-muted">Chargement des dossiers…</p>}
      {dossiers && divisionId && (
        <div className="mt-1.5 border-t border-[#F0F1F6] pt-1.5">
          {!creation ? (
            <button type="button" onClick={() => (setCreation(true), setTimeout(() => champ.current?.focus(), 0))} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-[13px] font-semibold text-ink hover:bg-bg">
              <Plus aria-hidden size={15} /> Nouveau dossier
            </button>
          ) : (
            <form
              className="p-1"
              onSubmit={(e) => {
                e.preventDefault();
                void creer();
              }}
            >
              <label htmlFor="nom-dossier" className="mb-1 block text-[12px] font-semibold text-text">
                {parent ? `Nouveau dossier dans « ${parent.name} »` : 'Nouveau dossier'}
              </label>
              <input
                id="nom-dossier"
                ref={champ}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom du dossier"
                className="mb-1.5 h-8 w-full rounded-[7px] border border-line px-2.5 text-[13px] focus:border-ink focus:outline-none"
              />
              {erreurCreation && <p className="mb-1.5 text-[12px] text-clay">{erreurCreation}</p>}
              <div className="flex gap-1.5">
                <button type="submit" disabled={busy || !nom.trim()} className="h-[30px] rounded-[7px] bg-ink px-3 text-[12.5px] font-bold text-white disabled:opacity-50">
                  Créer
                </button>
                <button type="button" onClick={() => (setCreation(false), setNom(''), setErreurCreation(null))} className="h-[30px] rounded-[7px] border border-line px-3 text-[12.5px] font-bold text-ink hover:bg-bg">
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </nav>
  );
});
