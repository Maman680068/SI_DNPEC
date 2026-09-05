'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { createLeaveRequest } from '../../lib/api/leaves';
import type { LeaveRequest, LeaveType } from '../../lib/leaves/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Même formule que LeaveRequestsService.create — aperçu uniquement, le nombre de
 * jours retenu est toujours celui recalculé par l'API à la création. */
function computeDaysCount(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

export function CreateLeaveRequestModal({
  leaveTypes,
  onClose,
  onCreated,
}: {
  leaveTypes: LeaveType[];
  onClose: () => void;
  onCreated: (request: LeaveRequest) => void;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysCount = useMemo(() => computeDaysCount(startDate, endDate), [startDate, endDate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const request = await createLeaveRequest({ leaveTypeId, startDate, endDate, reason: reason.trim() || undefined });
      onCreated(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer la demande');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Nouvelle demande de congé</h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Type de congé</label>
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="Date de début" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          <Field label="Date de fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>

        <div className="mb-4 rounded-md bg-bg px-3.5 py-2.5 text-[13px]">
          {daysCount === null ? (
            <span className="text-text-faint">Sélectionnez les deux dates pour voir le nombre de jours.</span>
          ) : (
            <span>
              Durée : <strong>{daysCount} jour{daysCount > 1 ? 's' : ''}</strong>
            </span>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Motif (optionnel)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
          />
        </div>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || daysCount === null || !leaveTypeId}>
            {submitting ? 'Envoi…' : 'Soumettre la demande'}
          </Button>
        </div>
      </form>
    </div>
  );
}
