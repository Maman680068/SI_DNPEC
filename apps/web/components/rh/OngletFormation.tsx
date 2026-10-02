'use client';

import { useCallback, useEffect, useState } from 'react';
import { exprimerBesoin, getPlanFormation, statutBesoin } from '../../lib/api/rh';
import type { OrigineFormation, PlanFormation, PrioriteFormation, StatutFormation } from '../../lib/rh/types';
import { LIBELLE_ORIGINE, LIBELLE_STATUT_FORMATION } from '../../lib/rh/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';
const TON_PRIORITE = { HAUTE: 'clay', MOYENNE: 'gold', BASSE: 'muted' } as const;
const LIBELLE_PRIORITE: Record<PrioriteFormation, string> = { HAUTE: 'Priorité haute', MOYENNE: 'Priorité moyenne', BASSE: 'Priorité basse' };

/** Plan de formation (SIG-RF-CAR-08) : besoins exprimés par les unités, consolidés par le DRH. */
export function OngletFormation() {
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [p, setP] = useState<PlanFormation | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => getPlanFormation(annee).then(setP).catch((x) => setErreur(messageChargement(x))), [annee]);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!p) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  return (
    <div className="max-w-[900px]">
      <ErreurChargement message={erreur} />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <label className="text-[12.5px] font-semibold">
          Année
          <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} className="ml-2 rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]">
            {[annee - 1, annee, annee + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        {p.droits.exprimer && <Button variant="solid" onClick={() => setNouveau(true)}>+ Exprimer un besoin</Button>}
      </div>
      {p.besoins.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucun besoin exprimé pour {annee}.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface" data-testid="besoins-formation">
          {p.besoins.map((b) => (
            <li key={b.id} data-testid="besoin" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{b.intitule}</div>
                <div className="text-[12px] text-text-muted">{b.unite} · {LIBELLE_ORIGINE[b.origine]} · {b.effectif} agent(s)</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={TON_PRIORITE[b.priorite]}>{LIBELLE_PRIORITE[b.priorite]}</Badge>
                {p.droits.decider ? (
                  <select aria-label={`Statut du besoin ${b.intitule}`} value={b.statut} onChange={(e) => statutBesoin(b.id, e.target.value).then(charger).catch((x) => setErreur(messageChargement(x)))} className="rounded-md border border-line bg-surface px-2 py-1 text-[12.5px]">
                    {(Object.keys(LIBELLE_STATUT_FORMATION) as StatutFormation[]).map((s) => <option key={s} value={s}>{LIBELLE_STATUT_FORMATION[s]}</option>)}
                  </select>
                ) : (
                  <Badge tone={b.statut === 'RETENU' || b.statut === 'REALISE' ? 'sage' : 'muted'}>{LIBELLE_STATUT_FORMATION[b.statut]}</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {nouveau && <FenetreBesoin annee={annee} unite={p.monUnite} onClose={() => setNouveau(false)} onFait={() => (setNouveau(false), charger())} />}
    </div>
  );
}

function FenetreBesoin({ annee, unite, onClose, onFait }: { annee: number; unite: string | null; onClose: () => void; onFait: () => void }) {
  const [v, setV] = useState({ intitule: '', priorite: 'MOYENNE' as PrioriteFormation, origine: 'ENTRETIEN' as OrigineFormation, effectif: '1' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Fenetre
      titre={`Besoin de formation — ${unite ?? ''}`}
      onClose={onClose}
      enCours={enCours}
      erreur={erreur}
      libelleValider="Exprimer le besoin"
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await exprimerBesoin({ annee, intitule: v.intitule, priorite: v.priorite, origine: v.origine, effectif: Number(v.effectif) || 1 });
          onFait();
        } catch (x) {
          setErreur(messageChargement(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <label className="mb-3 block text-[12.5px] font-semibold">Intitulé de la formation<input required value={v.intitule} onChange={set('intitule')} className={champ} /></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-[12.5px] font-semibold">Priorité
          <select value={v.priorite} onChange={set('priorite')} className={champ}>
            {(Object.keys(LIBELLE_PRIORITE) as PrioriteFormation[]).map((x) => <option key={x} value={x}>{LIBELLE_PRIORITE[x]}</option>)}
          </select>
        </label>
        <label className="block text-[12.5px] font-semibold">Origine
          <select value={v.origine} onChange={set('origine')} className={champ}>
            {(Object.keys(LIBELLE_ORIGINE) as OrigineFormation[]).map((x) => <option key={x} value={x}>{LIBELLE_ORIGINE[x]}</option>)}
          </select>
        </label>
        <label className="block text-[12.5px] font-semibold">Agents concernés<input type="number" min={1} max={500} value={v.effectif} onChange={set('effectif')} className={champ} /></label>
      </div>
    </Fenetre>
  );
}
