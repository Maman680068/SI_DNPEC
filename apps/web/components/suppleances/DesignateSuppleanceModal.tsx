'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createSuppleance, getSuppleanceCandidates } from '../../lib/api/suppleances';
import type { SuppleanceParty } from '../../lib/suppleances/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

const SELECT_CLASS =
  'w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent';

function partyLabel(p: SuppleanceParty, selfId: string): string {
  return `${p.firstName} ${p.lastName} — ${ROLE_LABEL[p.role]}${p.id === selfId ? ' (vous)' : ''}`;
}

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
  onCreated: () => void;
}) {
  const [titulaireId, setTitulaireId] = useState(titulaires.find((t) => t.id === selfId)?.id ?? titulaires[0]?.id ?? '');
  const [candidates, setCandidates] = useState<SuppleanceParty[] | null>(null);
  const [suppleantId, setSuppleantId] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!titulaireId) return;
    setCandidates(null);
    setSuppleantId('');
    getSuppleanceCandidates(titulaireId)
      .then(setCandidates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les suppléants possibles'));
  }, [titulaireId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSuppleance({
        titulaireId,
        suppleantId,
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de désigner ce suppléant');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-lg bg-surface p-6"
      >
        <h2 className="mb-1.5 text-[19px] font-semibold">Désigner un suppléant</h2>
        <p className="mb-5 text-[12.5px] text-text-muted">
          Le suppléant pourra agir au nom du titulaire pendant la période, sur choix explicite, et chacune de ses
          actions sera journalisée « par intérim, au nom de ».
        </p>

        <div className="mb-4">
          <label htmlFor="titulaire" className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Titulaire
          </label>
          <select id="titulaire" value={titulaireId} onChange={(e) => setTitulaireId(e.target.value)} className={SELECT_CLASS} required>
            {titulaires.map((t) => (
              <option key={t.id} value={t.id}>
                {partyLabel(t, selfId)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="suppleant" className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Suppléant (rang comparable)
          </label>
          <select
            id="suppleant"
            value={suppleantId}
            onChange={(e) => setSuppleantId(e.target.value)}
            className={SELECT_CLASS}
            disabled={!candidates}
            required
          >
            <option value="">{candidates === null ? 'Chargement…' : candidates.length === 0 ? 'Aucun suppléant possible' : 'Choisir…'}</option>
            {candidates?.map((c) => (
              <option key={c.id} value={c.id}>
                {partyLabel(c, selfId)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Field label="Du" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Field label="Au (inclus)" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !titulaireId || !suppleantId || !endDate}>
            {submitting ? 'Désignation…' : 'Désigner'}
          </Button>
        </div>
      </form>
    </div>
  );
}
