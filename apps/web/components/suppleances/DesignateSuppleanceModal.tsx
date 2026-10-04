'use client';

import { useEffect, useState } from 'react';
import { createSuppleance, getSuppleanceCandidates } from '../../lib/api/suppleances';
import type { SuppleanceParty } from '../../lib/suppleances/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { ChampDate, FenetreFormulaire, Grille2, SelecteurPersonnes } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

const personne = (p: SuppleanceParty, selfId: string) => ({ id: p.id, nom: `${p.firstName} ${p.lastName}${p.id === selfId ? ' (vous)' : ''}`, detail: ROLE_LABEL[p.role] });

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Désignation d'un suppléant. Titulaires et candidats viennent de l'API
 * (GET /suppleances/titulaires et /candidats) : seuls des choix que la
 * désignation acceptera sont proposés — règle du rang comparable comprise,
 * jamais dupliquée ici. Période en jours entiers : du début de la date de
 * début à la fin de la date de fin (heure locale).
 */
export function DesignateSuppleanceModal({
  selfId,
  titulaires,
  onClose,
  onCreated,
}: {
  selfId: string;
  titulaires: SuppleanceParty[];
  onClose: () => void;
  onCreated: (suppleant: string) => void;
}) {
  const [titulaireId, setTitulaireId] = useState(titulaires.find((t) => t.id === selfId)?.id ?? titulaires[0]?.id ?? '');
  const [candidates, setCandidates] = useState<SuppleanceParty[] | null>(null);
  const [suppleantId, setSuppleantId] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCandidates(null);
    setSuppleantId('');
    if (!titulaireId) return;
    getSuppleanceCandidates(titulaireId)
      .then(setCandidates)
      .catch((err) => setError(messageErreur(err, 'Impossible de charger les suppléants possibles')));
  }, [titulaireId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await createSuppleance({
        titulaireId,
        suppleantId,
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
      });
      const c = candidates?.find((x) => x.id === suppleantId);
      onCreated(c ? `${c.firstName} ${c.lastName}` : '');
    } catch (err) {
      setError(messageErreur(err, 'Impossible de désigner ce suppléant'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Désigner un suppléant"
      sousTitre="Le suppléant agit au nom du titulaire pendant la période, sur choix explicite."
      onClose={onClose}
      onSubmit={handleSubmit}
      enCours={submitting}
      erreur={error}
      libelleValider="Désigner le suppléant"
      pied="Chacune de ses actions sera journalisée « par intérim, au nom de » ; le suppléant est prévenu."
      valider={() => (startDate && endDate && endDate < startDate ? { 'sup-fin': 'La fin ne peut pas précéder le début.' } : {})}
    >
      <Grille2>
        <SelecteurPersonnes
          id="titulaire"
          label="Titulaire"
          multiple={false}
          required
          messageObligatoire="Choisissez le titulaire."
          options={titulaires.map((t) => personne(t, selfId))}
          valeurs={titulaireId ? [titulaireId] : []}
          onChange={(ids) => setTitulaireId(ids[0] ?? '')}
        />
        <SelecteurPersonnes
          id="suppleant"
          label="Suppléant (rang comparable)"
          multiple={false}
          required
          messageObligatoire="Choisissez le suppléant."
          placeholder={!titulaireId ? 'Choisissez d’abord le titulaire' : candidates === null ? 'Chargement des suppléants possibles…' : candidates.length === 0 ? 'Aucun suppléant possible' : 'Rechercher un suppléant…'}
          options={(candidates ?? []).map((c) => personne(c, selfId))}
          valeurs={suppleantId ? [suppleantId] : []}
          onChange={(ids) => setSuppleantId(ids[0] ?? '')}
        />
        <ChampDate id="sup-debut" label="Du" value={startDate} onChange={setStartDate} required />
        <ChampDate id="sup-fin" label="Au (inclus)" value={endDate} onChange={setEndDate} required messageObligatoire="Indiquez la date de fin." />
      </Grille2>
    </FenetreFormulaire>
  );
}
