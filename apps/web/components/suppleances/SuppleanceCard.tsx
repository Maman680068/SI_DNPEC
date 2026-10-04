'use client';

import type { Suppleance } from '../../lib/suppleances/types';
import { SUPPLEANCE_STATUS_LABEL, SUPPLEANCE_STATUS_TONE, suppleanceStatus } from '../../lib/suppleances/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, Pastille, type TonPastille } from '../ui/Charte';

const TON: Record<keyof typeof SUPPLEANCE_STATUS_TONE, TonPastille> = { A_VENIR: 'bleu', EN_COURS: 'vert', TERMINEE: 'gris', REVOQUEE: 'gris', NON_CONFORME: 'rouge' };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PartyLine({ label, party }: { label: string; party: Suppleance['titulaire'] }) {
  return (
    <div className="min-w-0 text-[13px]">
      <span className="text-text-muted">{label} </span>
      <span className="font-semibold">
        {party.firstName} {party.lastName}
      </span>
      <span className="text-text-muted"> · {ROLE_LABEL[party.role]}</span>
    </div>
  );
}

/** Une suppléance, en carte (pleine largeur sur mobile, actions à droite à partir de sm). */
export function SuppleanceCard({
  suppleance,
  isCurrentInterim,
  canAct,
  canRevoke,
  pending,
  onAct,
  onRevoke,
}: {
  suppleance: Suppleance;
  isCurrentInterim: boolean;
  canAct: boolean;
  canRevoke: boolean;
  pending: boolean;
  onAct: () => void;
  onRevoke: () => void;
}) {
  const status = suppleanceStatus(suppleance);

  return (
    <div className="flex flex-col gap-2 border-b border-[#F0F1F6] px-[18px] py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Pastille ton={TON[status]}>{SUPPLEANCE_STATUS_LABEL[status]}</Pastille>
          {isCurrentInterim && <Pastille ton="ambre">Intérim actif dans cet onglet</Pastille>}
          <span className="text-[12.5px] text-text-muted">
            du {formatDay(suppleance.startDate)} au {formatDay(suppleance.endDate)}
          </span>
        </div>
        <PartyLine label="Titulaire" party={suppleance.titulaire} />
        <PartyLine label="Suppléant" party={suppleance.suppleant} />
        {status === 'NON_CONFORME' && (
          <p className="pt-1 text-[12px] text-clay">
            Ne respecte pas la règle de rang comparable : inutilisable, à révoquer puis redésigner.
          </p>
        )}
      </div>
      {(canAct || canRevoke) && (
        <div className="flex flex-shrink-0 flex-wrap gap-1.5">
          {canAct && (
            <button type="button" className={`${BTN_LIGNE_PRINCIPAL} disabled:opacity-50`} disabled={pending || isCurrentInterim} onClick={onAct}>
              Agir en intérim
            </button>
          )}
          {canRevoke && (
            <button type="button" className={`${BTN_LIGNE} !border-[#E7B3BB] !text-clay disabled:opacity-50`} disabled={pending} onClick={onRevoke}>
              Révoquer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
