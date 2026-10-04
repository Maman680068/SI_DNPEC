'use client';

import { Lock } from 'lucide-react';
import type { Acte, Arrivee, Imputation } from '../../lib/courrier/types';
import { ACTE_STATUT_LABEL, NATURE_IMPUTATION_LABEL, nomPersonne } from '../../lib/courrier/types';
import { TON_ACTE, dateActe, dateCourte, echeanceArrivee, enRetard, etapeActe, imputationsRacines, objetArrivee, pastilleArrivee } from '../../lib/courrier/affichage';
import { LigneTableau, Pastille } from '../ui/Charte';

export { enRetard };

/** Colonnes des registres (maquette : n° 118 px, date 84 px…). */
export const GRILLE_ARRIVEES = 'lg:grid-cols-[118px_84px_minmax(0,1.2fr)_minmax(0,1.6fr)_150px_84px_112px]';
export const COLONNES_ARRIVEES = ['N° d’ordre', 'Reçu le', 'Expéditeur', 'Objet', 'Imputé à', 'Échéance', 'Statut'];
export const GRILLE_ACTES = 'lg:grid-cols-[118px_84px_minmax(0,1.1fr)_minmax(0,1.6fr)_130px_150px_104px]';
export const COLONNES_ACTES = ['N°', 'Date', 'Destinataire', 'Objet', 'Rédacteur', 'Étape du circuit', 'Statut'];
export const GRILLE_IMPUTATIONS = 'lg:grid-cols-[118px_92px_minmax(0,1.6fr)_minmax(0,1fr)_130px_112px]';
export const COLONNES_IMPUTATIONS = ['N° d’ordre', 'Échéance', 'Objet', 'Imputé par', 'Nature', 'Suivi'];

const NUMERO = 'block font-heading text-[13.5px] font-bold tabular-nums text-ink';
const SOUS = 'block truncate text-[12px] text-text-muted';
const UNE_LIGNE = 'block truncate';

/** Mention « Confidentiel » (rouge, cadenas) ou « Pli personnel » sous l'objet. */
export function MentionConfidentialite({ c }: { c: Arrivee['confidentialite'] }) {
  if (c === 'ORDINAIRE') return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11.5px] font-bold ${c === 'CONFIDENTIEL' ? 'text-clay' : 'text-ambre'}`}>
      <Lock aria-hidden size={12} />
      {c === 'CONFIDENTIEL' ? 'Confidentiel' : 'Pli personnel'}
    </span>
  );
}

export function LigneArrivee({ a, unite, onOpen }: { a: Arrivee; unite: (key: string) => string; onOpen: () => void }) {
  const racines = imputationsRacines(a);
  const ech = echeanceArrivee(a);
  const p = pastilleArrivee(a);
  return (
    <LigneTableau grille={GRILLE_ARRIVEES} onClick={onOpen} testid="ligne-arrivee" label={`Courrier ${a.numero}`}>
      <>
        <span className={NUMERO}>{a.numero}</span>
        <span className={SOUS}>
          {a.registre.code}
          {a.registre.portee === 'UNITE' ? ` · ${unite(a.uniteKey)}` : ''}
        </span>
      </>
      <span className="text-text-muted">{dateCourte(a.dateReception)}</span>
      <>
        <span className={`${UNE_LIGNE} text-[#3A4152]`}>{a.expediteur}</span>
        {a.referenceExpediteur && <span className={SOUS}>Réf. {a.referenceExpediteur}</span>}
      </>
      <>
        <span className={`${UNE_LIGNE} font-medium`} title={objetArrivee(a)}>
          {objetArrivee(a)}
        </span>
        <MentionConfidentialite c={a.confidentialite} />
      </>
      <span className={`${UNE_LIGNE} text-[12.5px] text-text-muted`}>
        {racines.length === 0 ? '—' : `${nomPersonne(a.personnes, racines[0]!.imputeAId)}${racines.length > 1 ? ` +${racines.length - 1}` : ''}`}
      </span>
      <span className={`text-[12.5px] ${ech && enRetard(ech) ? 'font-semibold text-clay' : 'text-text-muted'}`}>{ech ? dateCourte(ech.echeance) : '—'}</span>
      <Pastille ton={p.ton}>{p.label}</Pastille>
    </LigneTableau>
  );
}

export function LigneImputation({ a, i, onOpen }: { a: Arrivee; i: Imputation; onOpen: () => void }) {
  const retard = enRetard(i);
  return (
    <LigneTableau grille={GRILLE_IMPUTATIONS} onClick={onOpen} testid="ligne-imputation" label={`Courrier ${a.numero}`}>
      <span className={NUMERO}>{a.numero}</span>
      <span className={`text-[12.5px] ${retard ? 'font-semibold text-clay' : 'text-text-muted'}`}>{i.echeance ? dateCourte(i.echeance) : '—'}</span>
      <>
        <span className={`${UNE_LIGNE} font-medium`}>{a.objet ?? '—'}</span>
        <MentionConfidentialite c={a.confidentialite} />
      </>
      <span className={`${UNE_LIGNE} text-[12.5px] text-text-muted`}>
        {nomPersonne(a.personnes, i.imputeParId)}
        {i.auNomDeId ? ` (P.I. de ${nomPersonne(a.personnes, i.auNomDeId)})` : ''}
        {i.parentId ? ' · sous-imputation' : ''}
      </span>
      <span className="text-[12.5px] text-text-muted">{NATURE_IMPUTATION_LABEL[i.nature]}</span>
      {retard ? <Pastille ton="rouge">En retard</Pastille> : <Pastille ton="encre">En cours</Pastille>}
    </LigneTableau>
  );
}

export function LigneActe({ a, onOpen }: { a: Acte; onOpen: () => void }) {
  return (
    <LigneTableau grille={GRILLE_ACTES} onClick={onOpen} testid="ligne-acte" label={`${a.numero ?? 'Acte non numéroté'} — ${a.objet}`}>
      <>
        <span className={a.numero ? NUMERO : 'block text-[13px] italic text-text-muted'}>{a.numero ?? 'Non numéroté'}</span>
        <span className={SOUS}>{a.registre.code}</span>
      </>
      <span className="text-text-muted">{dateCourte(dateActe(a))}</span>
      <span className={`${UNE_LIGNE} text-[#3A4152]`}>{a.destinataires ?? '—'}</span>
      <>
        <span className={`${UNE_LIGNE} font-medium`} title={a.objet}>
          {a.objet}
        </span>
        <MentionConfidentialite c={a.confidentialite} />
      </>
      <span className={`${UNE_LIGNE} text-[12.5px] text-text-muted`}>{nomPersonne(a.personnes, a.redacteurId)}</span>
      <span className="block text-[12.5px] text-text-muted lg:truncate">{etapeActe(a)}</span>
      <Pastille ton={TON_ACTE[a.statut]}>{ACTE_STATUT_LABEL[a.statut]}</Pastille>
    </LigneTableau>
  );
}

/** Message de liste vide (administration du courrier). */
export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line py-6 text-center text-[13px] text-text-muted">{children}</p>;
}
