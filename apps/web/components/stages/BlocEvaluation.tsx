'use client';

import { useState } from 'react';
import { changerFormat, enregistrerEvaluation, soumettreEvaluation, viserEvaluation } from '../../lib/api/stages';
import type { FormatEvaluation, Niveau, Periode, Stage } from '../../lib/stages/types';
import { CRITERES, EVALUATION_STATUT_LABEL, FORMAT_LABEL, NIVEAU_LABEL } from '../../lib/stages/types';
import { SELECT_CLASS, TEXTAREA_CLASS } from '../courrier/ui';
import { messageErreur, useToast } from '../ui/Toast';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, Pastille } from '../ui/Charte';


/** Évaluation d'une période : affichage selon ce que l'API transmet, format
 * modifiable tant qu'elle n'est pas commencée, rédaction par le tuteur, visa. */
export function BlocEvaluation({ stage, periode, onChange, onRenvoyer }: { stage: Stage; periode: Periode; onChange: (s: Stage) => void; onRenvoyer: () => void }) {
  const ev = periode.evaluation;
  const [criteres, setCriteres] = useState<Record<string, string>>((ev?.criteres as Record<string, string>) ?? {});
  const [appreciation, setAppreciation] = useState(ev?.appreciation ?? '');
  const [enCours, setEnCours] = useState(false);
  const toast = useToast();

  async function agir(fn: () => Promise<Stage>, ok?: { titre: string; detail?: string; annuler?: () => void }) {
    setEnCours(true);
    try {
      onChange(await fn());
      if (ok) toast.succes(ok.titre, { detail: ok.detail, annuler: ok.annuler });
    } catch (e) {
      toast.erreur('Action impossible', messageErreur(e, 'Action impossible'));
    } finally {
      setEnCours(false);
    }
  }
  const enregistrer = () =>
    enregistrerEvaluation(stage.id, periode.id, { ...(periode.formatEvaluation === 'GRILLE' ? { criteres } : {}), appreciation });

  return (
    <div className="mt-3 rounded-[10px] border border-line bg-fond-doux px-3.5 py-3" data-testid={`evaluation-${periode.ordre}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold">Évaluation — {FORMAT_LABEL[periode.formatEvaluation]}</span>
        {ev && <Pastille ton={ev.statut === 'VISEE' ? 'vert' : ev.statut === 'RENVOYEE' ? 'rouge' : 'ambre'}>{EVALUATION_STATUT_LABEL[ev.statut]}</Pastille>}
      </div>

      {periode.droits.changerFormat && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`fmt-${periode.id}`} className="text-[12px] text-text-muted">
            Format
          </label>
          <select
            id={`fmt-${periode.id}`}
            className={`${SELECT_CLASS} !w-auto !py-1.5`}
            value={periode.formatEvaluation}
            disabled={enCours}
            onChange={(e) => {
              const avant = periode.formatEvaluation;
              const apres = e.target.value as FormatEvaluation;
              void agir(() => changerFormat(stage.id, periode.id, apres), {
                titre: 'Format enregistré',
                detail: FORMAT_LABEL[apres],
                annuler: () => void agir(() => changerFormat(stage.id, periode.id, avant)),
              });
            }}
          >
            {(Object.keys(FORMAT_LABEL) as FormatEvaluation[]).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
      )}

      {periode.droits.rediger ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void agir(enregistrer, { titre: 'Brouillon enregistré', detail: 'Vous pouvez le reprendre avant de le soumettre.' });
          }}
        >
          {ev?.statut === 'RENVOYEE' && ev.motifRenvoi && <p className="mb-2 text-[12.5px] text-clay">Renvoyée : {ev.motifRenvoi}</p>}
          {periode.formatEvaluation === 'GRILLE' && (
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              {CRITERES.map((c) => (
                <label key={c.cle} className="text-[12.5px]">
                  <span className="mb-1 block font-semibold">{c.libelle}</span>
                  <select className={SELECT_CLASS} value={criteres[c.cle] ?? ''} onChange={(e) => setCriteres({ ...criteres, [c.cle]: e.target.value })}>
                    <option value="">—</option>
                    {(Object.keys(NIVEAU_LABEL) as Niveau[]).map((n) => (
                      <option key={n} value={n}>
                        {NIVEAU_LABEL[n]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <label className="mb-2 block text-[12.5px]">
            <span className="mb-1 block font-semibold">Appréciation</span>
            <textarea className={TEXTAREA_CLASS} value={appreciation} onChange={(e) => setAppreciation(e.target.value)} maxLength={5000} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="submit" className={`${BTN_LIGNE} disabled:opacity-50`} disabled={enCours}>
              Enregistrer le brouillon
            </button>
            <button
              type="button"
              className={`${BTN_LIGNE_PRINCIPAL} disabled:opacity-50`}
              disabled={enCours}
              onClick={() =>
                agir(async () => {
                  await enregistrer();
                  return soumettreEvaluation(stage.id, periode.id);
                }, { titre: 'Évaluation soumise', detail: 'Le responsable de l’unité est prévenu pour le visa.' })
              }
            >
              Soumettre au visa
            </button>
          </div>
        </form>
      ) : ev ? (
        <div className="text-[13px]">
          {periode.formatEvaluation === 'GRILLE' && ev.criteres && (
            <dl className="mb-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {CRITERES.map((c) => (
                <div key={c.cle} className="flex justify-between gap-2">
                  <dt className="text-text-muted">{c.libelle}</dt>
                  <dd className="font-semibold">{ev.criteres?.[c.cle] ? NIVEAU_LABEL[ev.criteres[c.cle] as Niveau] : '—'}</dd>
                </div>
              ))}
            </dl>
          )}
          {ev.appreciation && <p className="whitespace-pre-wrap">{ev.appreciation}</p>}
          <p className="mt-1 text-[11.5px] text-text-faint">
            Rédigée par {ev.redacteur.firstName} {ev.redacteur.lastName}
            {ev.viseePar ? ` — visée par ${ev.viseePar.firstName} ${ev.viseePar.lastName}` : ''}
          </p>
        </div>
      ) : (
        <p className="text-[12.5px] text-text-faint">
          {periode.formatEvaluation === 'AUCUNE' ? 'Pas d’évaluation pour cette période.' : 'Pas encore d’évaluation transmise.'}
        </p>
      )}

      {periode.droits.viser && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button type="button" className={`${BTN_LIGNE} disabled:opacity-50`} disabled={enCours} onClick={onRenvoyer}>
            Renvoyer au tuteur
          </button>
          <button type="button" className={`${BTN_LIGNE_PRINCIPAL} disabled:opacity-50`} disabled={enCours} onClick={() => agir(() => viserEvaluation(stage.id, periode.id), { titre: 'Évaluation visée', detail: 'Le stagiaire peut la lire.' })}>
            Viser
          </button>
        </div>
      )}
    </div>
  );
}
