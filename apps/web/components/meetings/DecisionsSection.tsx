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
import { Badge } from '../ui/Badge';
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

  return (
    <li className="rounded-md border border-line p-3" data-testid="decision">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge tone={close ? 'sage' : action ? 'accent' : 'gold'}>{close ? 'Clôturée' : action ? 'Action en cours' : 'En attente'}</Badge>
        {close && decision.closedAt && (
          <span className="text-[11.5px] text-text-faint">
            le {formatDate(decision.closedAt)}
            {decision.closedById ? ` par ${getUserLabel(decision.closedById)}` : ''}
          </span>
        )}
      </div>

      {mode === 'modifier' ? (
        <form
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
            <Button type="button" variant="outline" onClick={() => setMode('lecture')}>
              Annuler
            </Button>
            <Button type="submit" variant="gold" disabled={pending}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{decision.content}</p>
      )}

      {action && (
        <div className="mt-2 rounded-md bg-bg px-3 py-2 text-[12.5px]">
          Action :{' '}
          <Link href={`/tasks/${action.id}`} className="font-semibold text-accent underline">
            {action.title}
          </Link>
          <span className="text-text-muted">
            {' '}
            — {STATUS_STEPS.find((s) => s.status === action.status)?.label ?? action.status}
            {action.dueDate ? `, échéance ${formatDate(action.dueDate)}` : ''}
          </span>
        </div>
      )}

      {mode === 'convertir' && <ConvertForm decision={decision} onDone={() => {
            setMode('lecture');
            onChanged();
          }} onCancel={() => setMode('lecture')} />}

      {error && (
        <div role="alert" className="mt-2 rounded-md bg-clay-soft px-3 py-2 text-[12.5px] text-clay">
          {error}
        </div>
      )}
      {info && <div className="mt-2 rounded-md bg-sage-soft px-3 py-2 text-[12.5px] text-sage">{info}</div>}

      {mode === 'lecture' && (droits.modifier || droits.convertir || droits.cloturer || droits.relancer) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {droits.modifier && (
            <Button variant="outline" className="px-3 py-1.5 text-[12.5px]" disabled={pending} onClick={() => setMode('modifier')}>
              Modifier
            </Button>
          )}
          {droits.convertir && (
            <Button variant="outline" className="px-3 py-1.5 text-[12.5px]" disabled={pending} onClick={() => setMode('convertir')}>
              Convertir en action
            </Button>
          )}
          {droits.cloturer && (
            <Button
              variant="outline"
              className="px-3 py-1.5 text-[12.5px]"
              disabled={pending}
              onClick={() => window.confirm('Clôturer cette décision ? Elle ne pourra plus être modifiée.') && run(() => closeDecision(decision.id), 'Clôture impossible')}
            >
              Clôturer
            </Button>
          )}
          {droits.relancer && (
            <Button
              variant="outline"
              className="px-3 py-1.5 text-[12.5px]"
              disabled={pending}
              onClick={() => run(() => remindDecision(decision.id), 'Relance impossible', 'Relance envoyée à l’organisateur.')}
            >
              Relancer l’organisateur
            </Button>
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
    <section className="mb-6" aria-label="Relevé de décisions">
      <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">
        Relevé de décisions{releve ? ` (${releve.decisions.length})` : ''}
      </div>
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
            <p className="mb-2.5 text-[13px] text-text-faint">Aucune décision consignée.</p>
          ) : (
            <ul className="mb-3 space-y-2.5">
              {releve.decisions.map((d) => (
                <DecisionItem key={`${d.id}-${d.updatedAt}`} decision={d} onChanged={charger} />
              ))}
            </ul>
          )}
          {releve.peutAjouter && (
            <form onSubmit={ajouter}>
              <textarea
                aria-label="Nouvelle décision"
                className={`${INPUT_CLASS} mb-2 min-h-[60px]`}
                placeholder="Consigner une décision…"
                value={nouvelle}
                onChange={(e) => setNouvelle(e.target.value)}
                required
                minLength={2}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="solid" disabled={pending || nouvelle.trim().length < 2}>
                  Ajouter la décision
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
