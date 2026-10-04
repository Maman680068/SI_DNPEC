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
import { Fenetre } from '../ui/Fenetre';
import { ChampDate, FenetreFormulaire, Saisie, SelecteurPersonnes, ZoneTexte } from '../ui/Formulaire';
import { Barre } from '../ui/Squelette';
import { messageErreur, useToast } from '../ui/Toast';

const message = (err: unknown, defaut: string) => messageErreur(err, defaut);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

/** Conversion d'une décision en action : le responsable se choisit parmi les
 * personnes que l'API accepterait (GET /decisions/:id/responsables-possibles). */
function ConvertForm({ decision, onDone, onCancel }: { decision: Decision; onDone: () => void; onCancel: () => void }) {
  const [responsables, setResponsables] = useState<ResponsablePossible[] | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let actuel = true;
    getResponsablesPossibles(decision.id)
      .then((r) => actuel && setResponsables(r))
      .catch((err) => actuel && setError(message(err, 'Impossible de charger les responsables possibles')));
    return () => {
      actuel = false;
    };
  }, [decision.id]);

  const personnes = (responsables ?? []).map((r) => ({ id: r.id, nom: `${r.firstName} ${r.lastName}`, detail: r.jobTitle }));

  async function submit() {
    const assigneeId = assigneeIds[0];
    if (!assigneeId) return;
    setPending(true);
    setError(null);
    try {
      await convertDecision(decision.id, { assigneeId, dueDate, title: title.trim() || undefined });
      const nom = personnes.find((p) => p.id === assigneeId)?.nom;
      toast.succes('Tâche créée', { detail: nom ? `${nom} a été prévenu.` : undefined });
      onDone();
    } catch (err) {
      setError(message(err, 'Conversion impossible'));
    } finally {
      setPending(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Convertir en action"
      sousTitre={decision.content}
      largeur={640}
      onClose={onCancel}
      onSubmit={submit}
      libelleValider="Créer la tâche"
      enCours={pending}
      erreur={error}
      testid="fenetre-convertir-decision"
      pied="Le responsable est prévenu immédiatement ; la tâche reste liée à la décision."
    >
      <Saisie id={`cv-titre-${decision.id}`} label="Intitulé de la tâche" facultatif value={title} onChange={setTitle} placeholder="Reprend le texte de la décision" maxLength={300} />
      <SelecteurPersonnes
        id={`cv-resp-${decision.id}`}
        label="Responsable"
        multiple={false}
        required
        messageObligatoire="Choisissez le responsable."
        options={personnes}
        valeurs={assigneeIds}
        onChange={setAssigneeIds}
        placeholder={responsables ? 'Rechercher le responsable…' : 'Liste en cours de chargement…'}
      />
      <ChampDate id={`cv-ech-${decision.id}`} label="Échéance" value={dueDate} onChange={setDueDate} required messageObligatoire="Choisissez l’échéance de la tâche." />
    </FenetreFormulaire>
  );
}

/** Modification du texte d'une décision. */
function FenetreModifierDecision({ decision, onClose, onDone }: { decision: Decision; onClose: () => void; onDone: () => void }) {
  const [content, setContent] = useState(decision.content);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  return (
    <FenetreFormulaire
      titre="Modifier la décision"
      largeur={600}
      onClose={onClose}
      enCours={pending}
      erreur={error}
      testid="fenetre-modifier-decision"
      pied="Les participants voient le texte à jour dans le relevé."
      valider={() => (content.trim().length < 2 ? { 'decision-texte': content.trim() ? 'Le texte compte au moins 2 caractères.' : 'Rédigez le texte de la décision.' } : {})}
      onSubmit={async () => {
        setPending(true);
        setError(null);
        try {
          await updateDecision(decision.id, content.trim());
          toast.succes('Décision modifiée');
          onDone();
        } catch (err) {
          setError(message(err, 'Modification impossible'));
        } finally {
          setPending(false);
        }
      }}
    >
      <ZoneTexte id="decision-texte" label="Texte de la décision" value={content} onChange={setContent} required lignes={4} />
    </FenetreFormulaire>
  );
}

function DecisionItem({ decision, onChanged }: { decision: Decision; onChanged: () => void }) {
  const { getUserLabel } = useOrg();
  const [mode, setMode] = useState<'lecture' | 'modifier' | 'convertir' | 'cloturer'>('lecture');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { droits, action } = decision;
  const close = decision.status === 'CLOTUREE';

  async function run(fn: () => Promise<unknown>, defaut: string, succes: [string, string?]) {
    setPending(true);
    setError(null);
    try {
      await fn();
      toast.succes(succes[0], succes[1] ? { detail: succes[1] } : undefined);
      setMode('lecture');
      onChanged();
    } catch (err) {
      if (mode === 'cloturer') setError(message(err, defaut));
      else toast.erreur('Action impossible', message(err, defaut));
    } finally {
      setPending(false);
    }
  }

  const petit = 'inline-flex h-[28px] items-center rounded-[7px] border border-line px-2.5 text-[12px] font-bold text-ink hover:bg-bg disabled:opacity-50';
  return (
    <li className="border-b border-[#F0F1F6] py-2" data-testid="decision">
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5">
        <Pastille ton={close ? 'vert' : action ? 'encre' : 'gris'}>{close ? 'Clôturée' : action ? 'Tâche créée' : 'À convertir'}</Pastille>
        {<p className="min-w-0 flex-1 whitespace-pre-wrap pt-0.5 text-[13.5px] leading-snug">{decision.content}</p>}
      </div>
      {close && decision.closedAt && (
        <p className="mt-1 text-[12px] text-text-muted">
          Le {formatDate(decision.closedAt)}
          {decision.closedById ? ` par ${getUserLabel(decision.closedById)}` : ''}
        </p>
      )}

      {mode === 'modifier' && (
        <FenetreModifierDecision
          decision={decision}
          onClose={() => setMode('lecture')}
          onDone={() => {
            setMode('lecture');
            onChanged();
          }}
        />
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

      {mode === 'cloturer' && (
        <Fenetre
          titre="Clôturer la décision"
          onClose={() => setMode('lecture')}
          onSubmit={() => run(() => closeDecision(decision.id), 'Clôture impossible', ['Décision clôturée', 'Elle ne peut plus être modifiée.'])}
          libelleValider="Clôturer"
          enCours={pending}
          erreur={error}
          pied="Une décision clôturée ne peut plus être modifiée."
        >
          <p className="text-[13.5px]">Clôturer « {decision.content} » ?</p>
        </Fenetre>
      )}

      {(mode === 'lecture' || mode === 'cloturer') && (droits.modifier || droits.convertir || droits.cloturer || droits.relancer) && (
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
              onClick={() => {
                setError(null);
                setMode('cloturer');
              }}
            >
              Clôturer
            </button>
          )}
          {droits.relancer && (
            <button type="button" className={petit} disabled={pending} onClick={() => run(() => remindDecision(decision.id), 'Relance impossible', ['Relance envoyée à l’organisateur', decision.content])}>
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
  const toast = useToast();

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
      toast.succes('Décision ajoutée', { detail: nouvelle.trim() });
      setNouvelle('');
      charger();
    } catch (err) {
      toast.erreur('Action impossible', message(err, 'Ajout impossible'));
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
        !error && (
          <div role="status" aria-label="Chargement en cours" className="space-y-2.5 py-1.5" data-testid="squelette">
            <Barre className="h-3 w-[70%]" />
            <Barre className="h-3 w-[55%]" />
          </div>
        )
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
