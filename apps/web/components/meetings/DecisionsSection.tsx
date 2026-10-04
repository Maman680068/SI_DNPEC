'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import {
  closeDecision,
  convertDecision,
  createDecision,
  getDecisions,
  getResponsablesPossibles,
  remindDecision,
  updateDecision,
} from '../../lib/api/meetings';
import type { Decision, DecisionsReleve, ResponsablePossible } from '../../lib/meetings/types';
import { STATUS_STEPS } from '../../lib/tasks/types';
import { Pastille } from '../ui/Charte';
import { Button } from '../ui/Button';

const INPUT_CLASS = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px]';

const message = (err: unknown, defaut: string) => (err instanceof Error ? err.message : defaut);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

/** Conversion d'une décision en action : le responsable se choisit parmi les
 * personnes que l'API accepterait (GET /decisions/:id/responsables-possibles). */
function ConvertForm({ decision, onDone, onCancel }: { decision: Decision; onDone: () => void; onCancel: () => void }) {
  const [responsables, setResponsables] = useState<ResponsablePossible[] | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let actuel = true;
    getResponsablesPossibles(decision.id)
      .then((r) => actuel && setResponsables(r))
      .catch((err) => actuel && setError(message(err, 'Impossible de charger les responsables possibles')));
    return () => {
      actuel = false;
    };
  }, [decision.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await convertDecision(decision.id, { assigneeId, dueDate, title: title.trim() || undefined });
      onDone();
    } catch (err) {
      setError(message(err, 'Conversion impossible'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Convertir en action" className="mt-2.5 rounded-md border border-line bg-bg p-3">
      <label htmlFor={`cv-titre-${decision.id}`} className="mb-1 block text-[12px] font-semibold">
        Intitulé de la tâche (facultatif)
      </label>
      <input
        id={`cv-titre-${decision.id}`}
        className={`${INPUT_CLASS} mb-2.5`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Reprend le texte de la décision"
        maxLength={300}
      />
      <label htmlFor={`cv-resp-${decision.id}`} className="mb-1 block text-[12px] font-semibold">
        Responsable
      </label>
      <select
        id={`cv-resp-${decision.id}`}
        className={`${INPUT_CLASS} mb-2.5`}
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        required
        disabled={!responsables}
      >
        <option value="">{responsables ? 'Choisir…' : 'Chargement…'}</option>
        {responsables?.map((r) => (
          <option key={r.id} value={r.id}>
            {r.firstName} {r.lastName}
            {r.jobTitle ? ` — ${r.jobTitle}` : ''}
          </option>
        ))}
      </select>
      <label htmlFor={`cv-ech-${decision.id}`} className="mb-1 block text-[12px] font-semibold">
        Échéance
      </label>
      <input id={`cv-ech-${decision.id}`} type="date" className={`${INPUT_CLASS} mb-2.5`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
      {error && (
        <div role="alert" className="mb-2.5 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay">
          {error}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" variant="gold" disabled={pending || !responsables}>
          {pending ? 'Création…' : 'Créer la tâche'}
        </Button>
      </div>
    </form>
  );
}

function DecisionItem({ decision, onChanged }: { decision: Decision; onChanged: () => void }) {
  const { getUserLabel } = useOrg();
  const [mode, setMode] = useState<'lecture' | 'modifier' | 'convertir'>('lecture');
  const [content, setContent] = useState(decision.content);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { droits, action } = decision;
  const close = decision.status === 'CLOTUREE';

  async function run(fn: () => Promise<unknown>, defaut: string, apres?: string) {
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (apres) setInfo(apres);
      setMode('lecture');
      onChanged();
    } catch (err) {
      setError(message(err, defaut));
    } finally {
      setPending(false);
    }
  }

  const petit = 'inline-flex h-[28px] items-center rounded-[7px] border border-line px-2.5 text-[12px] font-bold text-ink hover:bg-bg disabled:opacity-50';
  return (
    <li className="border-b border-[#F0F1F6] py-2" data-testid="decision">
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5">
        <Pastille ton={close ? 'vert' : action ? 'encre' : 'gris'}>{close ? 'Clôturée' : action ? 'Tâche créée' : 'À convertir'}</Pastille>
        {mode !== 'modifier' && <p className="min-w-0 flex-1 whitespace-pre-wrap pt-0.5 text-[13.5px] leading-snug">{decision.content}</p>}
      </div>
      {close && decision.closedAt && (
        <p className="mt-1 text-[12px] text-text-muted">
          Le {formatDate(decision.closedAt)}
          {decision.closedById ? ` par ${getUserLabel(decision.closedById)}` : ''}
        </p>
      )}

      {mode === 'modifier' && (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateDecision(decision.id, content.trim()), 'Modification impossible');
          }}
        >
          <textarea
            aria-label="Texte de la décision"
            className={`${INPUT_CLASS} mb-2 min-h-[70px]`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            minLength={2}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className={petit} onClick={() => setMode('lecture')}>
              Annuler
            </button>
            <button type="submit" className={`${petit} border-ink bg-ink text-white hover:bg-ink-800`} disabled={pending}>
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {action && (
        <p className="mt-1 text-[12.5px] text-text-muted">
          Tâche :{' '}
          <Link href={`/tasks/${action.id}`} className="font-semibold text-ink underline">
            {action.title}
          </Link>{' '}
          — {STATUS_STEPS.find((s) => s.status === action.status)?.label ?? action.status}
          {action.dueDate ? `, échéance ${formatDate(action.dueDate)}` : ''}
        </p>
      )}

      {mode === 'convertir' && (
        <ConvertForm
          decision={decision}
          onDone={() => {
            setMode('lecture');
            onChanged();
          }}
          onCancel={() => setMode('lecture')}
        />
      )}

      {error && (
        <div role="alert" className="mt-2 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay">
          {error}
        </div>
      )}
      {info && <div className="mt-2 rounded-md bg-sage-50 px-3 py-2 text-[12.5px] text-sage">{info}</div>}

      {mode === 'lecture' && (droits.modifier || droits.convertir || droits.cloturer || droits.relancer) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {droits.modifier && (
            <button type="button" className={petit} disabled={pending} onClick={() => setMode('modifier')}>
              Modifier
            </button>
          )}
          {droits.convertir && (
            <button type="button" className={petit} disabled={pending} onClick={() => setMode('convertir')}>
              Convertir en action
            </button>
          )}
          {droits.cloturer && (
            <button
              type="button"
              className={petit}
              disabled={pending}
              onClick={() => window.confirm('Clôturer cette décision ? Elle ne pourra plus être modifiée.') && run(() => closeDecision(decision.id), 'Clôture impossible')}
            >
              Clôturer
            </button>
          )}
          {droits.relancer && (
            <button type="button" className={petit} disabled={pending} onClick={() => run(() => remindDecision(decision.id), 'Relance impossible', 'Relance envoyée à l’organisateur.')}>
              Relancer l’organisateur
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Relevé de décisions d'une réunion (D2). Tout ce qui s'affiche comme
 * possible vient de l'API (`peutAjouter`, `droits`) ; chaque action est
 * revérifiée par le serveur. */
export function DecisionsSection({ meetingId }: { meetingId: string }) {
  const [releve, setReleve] = useState<DecisionsReleve | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState('');
  const [pending, setPending] = useState(false);
  const requete = useRef(0);

  const charger = useCallback(() => {
    const n = ++requete.current;
    getDecisions(meetingId)
      .then((r) => {
        if (n !== requete.current) return;
        setReleve(r);
        setError(null);
      })
      .catch((err) => n === requete.current && setError(message(err, 'Impossible de charger les décisions')));
  }, [meetingId]);

  useEffect(() => {
    setReleve(null);
    charger();
  }, [charger]);

  async function ajouter(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createDecision(meetingId, nouvelle.trim());
      setNouvelle('');
      charger();
    } catch (err) {
      setError(message(err, 'Ajout impossible'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mb-[18px]" aria-label="Relevé de décisions">
      <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-ink-900">
        Décisions {releve && <span className="font-semibold text-text-muted">{releve.decisions.length}</span>}
      </h3>
      {error && (
        <div role="alert" className="mb-2.5 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">
          {error}
        </div>
      )}
      {!releve ? (
        !error && <p className="text-[13px] text-text-muted">Chargement…</p>
      ) : (
        <>
          {releve.decisions.length === 0 ? (
            <p className="py-1.5 text-[13px] text-text-muted">Aucune décision consignée.</p>
          ) : (
            <ul>
              {releve.decisions.map((d) => (
                <DecisionItem key={`${d.id}-${d.updatedAt}`} decision={d} onChanged={charger} />
              ))}
            </ul>
          )}
          {releve.peutAjouter && (
            <form onSubmit={ajouter} className="mt-2 flex flex-wrap gap-2">
              <input
                aria-label="Nouvelle décision"
                className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] placeholder:text-text-faint focus:border-ink focus:outline focus:outline-2 focus:outline-ink"
                placeholder="Ajouter une décision…"
                value={nouvelle}
                onChange={(e) => setNouvelle(e.target.value)}
                required
                minLength={2}
              />
              <button type="submit" className="h-10 flex-none rounded-[10px] border border-line bg-surface px-3.5 text-[13px] font-bold text-ink hover:bg-bg disabled:opacity-50" disabled={pending || nouvelle.trim().length < 2}>
                Ajouter la décision
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
