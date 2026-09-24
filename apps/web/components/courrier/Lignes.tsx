'use client';

import type { Acte, Arrivee, Imputation } from '../../lib/courrier/types';
import {
  ACTE_STATUT_LABEL,
  ACTE_STATUT_TONE,
  ARRIVEE_STATUT_LABEL,
  ARRIVEE_STATUT_TONE,
  CONFIDENTIALITE_LABEL,
  CONFIDENTIALITE_TONE,
  NATURE_IMPUTATION_LABEL,
  formatDate,
  nomPersonne,
} from '../../lib/courrier/types';
import { Badge } from '../ui/Badge';

const CARTE =
  'block w-full rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-accent hover:bg-bg focus:outline focus:outline-2 focus:outline-accent';

export function enRetard(i: Pick<Imputation, 'echeance' | 'statut'>): boolean {
  return i.statut === 'EN_COURS' && !!i.echeance && new Date(i.echeance) < new Date();
}

function objetArrivee(a: Arrivee): string {
  if (a.niveau === 'EXISTENCE') return `Pli personnel pour ${nomPersonne(a.personnes, a.destinataireId)} — contenu protégé`;
  return a.objet ?? (a.confidentialite === 'PERSONNEL' ? 'Pli personnel (objet non renseigné)' : '—');
}

export function LigneArrivee({ a, unite, onOpen }: { a: Arrivee; unite: (key: string) => string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={CARTE} data-testid="ligne-arrivee">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-heading text-[13.5px] font-bold text-ink">{a.numero}</span>
        <Badge tone={ARRIVEE_STATUT_TONE[a.statut]}>{ARRIVEE_STATUT_LABEL[a.statut].toUpperCase()}</Badge>
        {a.confidentialite !== 'ORDINAIRE' && <Badge tone={CONFIDENTIALITE_TONE[a.confidentialite]}>{CONFIDENTIALITE_LABEL[a.confidentialite].toUpperCase()}</Badge>}
        <span className="ml-auto text-[11.5px] text-text-faint">Reçu le {formatDate(a.dateReception)}</span>
      </div>
      <div className="break-words text-[13.5px] text-text">{objetArrivee(a)}</div>
      <div className="mt-1 break-words text-[12px] text-text-muted">
        {a.expediteur} · {a.registre.code}
        {a.registre.portee === 'UNITE' ? ` · ${unite(a.uniteKey)}` : ''}
      </div>
    </button>
  );
}

export function LigneImputation({ a, i, onOpen }: { a: Arrivee; i: Imputation; onOpen: () => void }) {
  const retard = enRetard(i);
  return (
    <button type="button" onClick={onOpen} className={CARTE} data-testid="ligne-imputation">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-heading text-[13.5px] font-bold text-ink">{a.numero}</span>
        <Badge tone="accent">{NATURE_IMPUTATION_LABEL[i.nature].toUpperCase()}</Badge>
        {retard && <Badge tone="clay">EN RETARD</Badge>}
        {i.echeance && (
          <span className={`ml-auto text-[11.5px] ${retard ? 'font-semibold text-clay' : 'text-text-faint'}`}>Échéance {formatDate(i.echeance)}</span>
        )}
      </div>
      <div className="break-words text-[13.5px] text-text">{a.objet ?? '—'}</div>
      <div className="mt-1 break-words text-[12px] text-text-muted">
        Imputé par {nomPersonne(a.personnes, i.imputeParId)}
        {i.auNomDeId ? ` (P.I. de ${nomPersonne(a.personnes, i.auNomDeId)})` : ''}
        {i.parentId ? ' · sous-imputation' : ''}
      </div>
    </button>
  );
}

export function LigneActe({ a, onOpen }: { a: Acte; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={CARTE} data-testid="ligne-acte">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`font-heading text-[13.5px] font-bold ${a.numero ? 'text-ink' : 'italic text-text-muted'}`}>{a.numero ?? 'Non numéroté'}</span>
        <Badge tone={ACTE_STATUT_TONE[a.statut]}>{ACTE_STATUT_LABEL[a.statut].toUpperCase()}</Badge>
        {a.confidentialite !== 'ORDINAIRE' && <Badge tone="clay">CONFIDENTIEL</Badge>}
        <span className="ml-auto text-[11.5px] text-text-faint">{a.signeAt ? `Signé le ${formatDate(a.signeAt)}` : `Modifié le ${formatDate(a.updatedAt)}`}</span>
      </div>
      <div className="break-words text-[13.5px] text-text">{a.objet}</div>
      <div className="mt-1 break-words text-[12px] text-text-muted">
        {a.registre.code} · Rédigé par {nomPersonne(a.personnes, a.redacteurId)}
        {a.destinataires ? ` · À : ${a.destinataires}` : ''}
      </div>
    </button>
  );
}

export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line py-6 text-center text-[13px] text-text-faint">{children}</p>;
}
