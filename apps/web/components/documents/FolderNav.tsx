'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
import { Folder as IconeDossier, Plus } from 'lucide-react';
import { createFolder } from '../../lib/api/documents';
import type { Folder } from '../../lib/documents/types';
import { FenetreFormulaire, Saisie } from '../ui/Formulaire';
import { Barre } from '../ui/Squelette';
import { useToast } from '../ui/Toast';
import { useEnvoi } from '../courrier/formulaire';

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
  const toast = useToast();
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const { enCours, erreur: erreurCreation, setErreur: setErreurCreation, envoyer } = useEnvoi();

  useImperativeHandle(ref, () => ({
    nouveauDossier: () => setCreation(true),
  }));

  const parent = dossiers?.find((f) => f.id === currentFolderId) ?? null;
  const fermer = () => {
    setCreation(false);
    setNom('');
    setErreurCreation(null);
  };

  async function creer() {
    if (!divisionId) return;
    const r = await envoyer(() => createFolder({ name: nom.trim(), divisionId, parentFolderId: currentFolderId ?? undefined }));
    if (!r.ok) return;
    onCreated(r.valeur);
    toast.succes('Dossier créé', { detail: parent ? `« ${r.valeur.name} » dans « ${parent.name} ».` : `« ${r.valeur.name} ».` });
    fermer();
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
          <IconeDossier aria-hidden size={niveau ? 15 : 16} className={`flex-none ${on ? 'text-ink' : 'text-text-faint'}`} />
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
      {dossiers === null && !erreur && (
        <div role="status" aria-label="Chargement en cours" className="space-y-2.5 px-2 py-2" data-testid="squelette">
          <span className="sr-only">Chargement en cours</span>
          <Barre className="h-3 w-[70%]" />
          <Barre className="h-3 w-[55%]" />
          <Barre className="h-3 w-[62%]" />
        </div>
      )}
      {dossiers && divisionId && (
        <div className="mt-1.5 border-t border-line-doux pt-1.5">
          <button type="button" onClick={() => setCreation(true)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-[13px] font-semibold text-ink hover:bg-bg">
            <Plus aria-hidden size={15} /> Nouveau dossier
          </button>
        </div>
      )}
      {creation && (
        <FenetreFormulaire
          titre="Nouveau dossier"
          sousTitre={parent ? `Dans « ${parent.name} »` : 'À la racine de l’espace'}
          libelleValider="Créer le dossier"
          largeur={520}
          enCours={enCours}
          erreur={erreurCreation}
          onClose={fermer}
          pied="Le dossier est visible des membres de la division."
          onSubmit={creer}
        >
          <Saisie id="nom-dossier" label="Nom du dossier" value={nom} onChange={setNom} required maxLength={200} messageObligatoire="Indiquez le nom du dossier." placeholder="Rapports trimestriels, Notes…" />
        </FenetreFormulaire>
      )}
    </nav>
  );
});
