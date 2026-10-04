'use client';

import { useCallback, useEffect, useState } from 'react';
import { exprimerBesoin, getPlanFormation, statutBesoin } from '../../lib/api/rh';
import type { OrigineFormation, PlanFormation, PrioriteFormation, StatutFormation } from '../../lib/rh/types';
import { LIBELLE_ORIGINE, LIBELLE_STATUT_FORMATION } from '../../lib/rh/types';
import { Plus } from 'lucide-react';
import { BandeCompteurs, BarreOutils, BTN_LIGNE, BTN_PRINCIPAL, EtatVide, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'mt-1 w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] font-normal';
const TON_PRIORITE = { HAUTE: 'rouge', MOYENNE: 'ambre', BASSE: 'gris' } as const;
const GRILLE = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_140px_130px]';
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
  const n = (st: StatutFormation) => p.besoins.filter((b) => b.statut === st).length;
  return (
    <div>
      <ErreurChargement message={erreur} />
      <BandeCompteurs
        label={`Plan de formation ${annee}`}
        items={[
          { valeur: n('EXPRIME'), label: 'Besoins exprimés', sous: 'à examiner par le DRH', ton: n('EXPRIME') ? 'ambre' : 'encre' },
          { valeur: n('RETENU'), label: 'Retenus', sous: `au plan ${annee}`, ton: 'vert' },
          { valeur: n('REALISE'), label: 'Réalisés', sous: 'formations suivies' },
          { valeur: p.besoins.reduce((t, b) => t + (b.statut === 'ECARTE' ? 0 : b.effectif), 0), label: 'Agents concernés', sous: 'hors besoins écartés', ton: 'gris' },
        ]}
      />
      <BarreOutils
        droite={
          p.droits.exprimer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setNouveau(true)}>
              <Plus aria-hidden size={16} /> Exprimer un besoin
            </button>
          )
        }
      >
        <select aria-label="Année" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} className="h-9 rounded-[9px] border border-line bg-surface px-2.5 text-[13px] font-semibold">
          {[annee - 1, annee, annee + 1].map((a) => <option key={a} value={a}>Année {a}</option>)}
        </select>
      </BarreOutils>
      <Tableau
        label={`Besoins de formation ${annee}`}
        testid="besoins-formation"
        grille={GRILLE}
        colonnes={['Formation', 'Unité', 'Origine', 'Priorité', 'Statut']}
        vide={
          <EtatVide
            texte={`Aucun besoin exprimé pour ${annee}.`}
            action={p.droits.exprimer ? <button type="button" className={BTN_LIGNE} onClick={() => setNouveau(true)}>Exprimer le premier besoin</button> : undefined}
          />
        }
      >
        {p.besoins.map((b) => (
          <LigneTableau key={b.id} grille={GRILLE} testid="besoin">
            <span className="block">
              <b className="block font-semibold text-ink-900">{b.intitule}</b>
              <small className="block text-[12px] text-text-muted">{b.effectif} agent(s)</small>
            </span>
            <span className="block truncate text-text-muted">{b.unite ?? '—'}</span>
            <span className="text-text-muted">{LIBELLE_ORIGINE[b.origine]}</span>
            <Pastille ton={TON_PRIORITE[b.priorite]}>{LIBELLE_PRIORITE[b.priorite]}</Pastille>
            {p.droits.decider ? (
              <select aria-label={`Statut du besoin ${b.intitule}`} value={b.statut} onChange={(e) => statutBesoin(b.id, e.target.value).then(charger).catch((x) => setErreur(messageChargement(x)))} className="h-[30px] rounded-[7px] border border-line bg-surface px-2 text-[12.5px] font-semibold">
                {(Object.keys(LIBELLE_STATUT_FORMATION) as StatutFormation[]).map((s) => <option key={s} value={s}>{LIBELLE_STATUT_FORMATION[s]}</option>)}
              </select>
            ) : (
              <Pastille ton={b.statut === 'RETENU' || b.statut === 'REALISE' ? 'vert' : 'gris'}>{LIBELLE_STATUT_FORMATION[b.statut]}</Pastille>
            )}
          </LigneTableau>
        ))}
      </Tableau>
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
