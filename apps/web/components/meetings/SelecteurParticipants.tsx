'use client';

import { useState } from 'react';
import type { ParticipantsPossibles } from '../../lib/meetings/types';
import { BTN_LIGNE } from '../ui/Charte';
import { Liste, SelecteurPersonnes } from '../ui/Formulaire';

/**
 * Participants d'une réunion ou d'une demande (S1) : « Ajouter une unité » (n'importe quelle unité de la
 * DNPEC, sous-unités comprises : ses membres sont ajoutés) puis ajout et retrait individuels. Les choix
 * viennent de l'API (personnes actives sans les stagiaires) ; la liste est figée à l'envoi.
 */
export function SelecteurParticipants({
  possibles,
  valeurs,
  onChange,
  unitesChoisies,
  onUnites,
  verrouille = false,
}: {
  possibles: ParticipantsPossibles | null;
  valeurs: string[];
  onChange: (ids: string[]) => void;
  unitesChoisies: string[];
  onUnites: (ids: string[]) => void;
  /** Participants validés par le chef : lecture seule. */
  verrouille?: boolean;
}) {
  const [unite, setUnite] = useState('');
  const personnes = (possibles?.personnes ?? []).map((p) => ({ id: p.id, nom: p.nom, detail: [p.fonction, p.unite].filter(Boolean).join(' · ') || null }));
  if (verrouille) {
    const noms = new Map(personnes.map((p) => [p.id, p.nom]));
    return (
      <div className="mb-3.5" data-testid="participants-verrouilles">
        <p className="mb-1.5 text-[13px] font-semibold text-text">Participants validés</p>
        <p className="rounded-[10px] border border-line bg-fond-doux px-3 py-2 text-[13px] text-text">
          {valeurs.length ? valeurs.map((id) => noms.get(id) ?? '—').join(', ') : 'Aucun autre participant'}
        </p>
      </div>
    );
  }
  const ajouterUnite = () => {
    const u = possibles?.unites.find((x) => x.id === unite);
    if (!u) return;
    onChange([...new Set([...valeurs, ...u.membres])]);
    if (!unitesChoisies.includes(u.id)) onUnites([...unitesChoisies, u.id]);
    setUnite('');
  };
  return (
    <div data-testid="selecteur-participants">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Liste
            id="participants-unite"
            label="Ajouter une unité"
            facultatif
            value={unite}
            onChange={setUnite}
            vide="Choisir une unité (ses membres sont ajoutés)"
            options={(possibles?.unites ?? []).map((u) => ({ value: u.id, label: `${'  '.repeat(u.niveau)}${u.code} — ${u.libelle} (${u.membres.length})` }))}
          />
        </div>
        <button type="button" className={`${BTN_LIGNE} mb-3.5 h-10`} disabled={!unite} onClick={ajouterUnite}>
          Ajouter l’unité
        </button>
      </div>
      <SelecteurPersonnes
        id="reunion-participants"
        label={`Participants${valeurs.length ? ` (${valeurs.length})` : ''}`}
        facultatif
        options={personnes}
        valeurs={valeurs}
        onChange={onChange}
        placeholder="Ajouter ou retirer une personne…"
      />
    </div>
  );
}
