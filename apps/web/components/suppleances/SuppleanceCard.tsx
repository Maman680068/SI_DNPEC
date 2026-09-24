'use client';

import type { Suppleance } from '../../lib/suppleances/types';
import { SUPPLEANCE_STATUS_LABEL, SUPPLEANCE_STATUS_TONE, suppleanceStatus } from '../../lib/suppleances/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PartyLine({ label, party }: { label: string; party: Suppleance['titulaire'] }) {
  return (
    <div className="min-w-0 text-[13px]">
      <span className="text-text-faint">{label} </span>
      <span className="font-semibold">
        {party.firstName} {party.lastName}
      </span>
      <span className="text-text-faint"> · {ROLE_LABEL[party.role]}</span>
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
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Badge tone={SUPPLEANCE_STATUS_TONE[status]}>{SUPPLEANCE_STATUS_LABEL[status]}</Badge>
          {isCurrentInterim && <Badge tone="gold">Intérim actif dans cet onglet</Badge>}
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
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {canAct && (
            <Button variant="gold" disabled={pending || isCurrentInterim} onClick={onAct}>
              Agir en intérim
            </Button>
          )}
          {canRevoke && (
            <Button variant="outline" className="border-clay text-clay hover:bg-clay-soft" disabled={pending} onClick={onRevoke}>
              Révoquer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
