import type { LeaveBalanceView } from '../../lib/leaves/types';
import { Card } from '../ui/Card';

export function BalanceCards({ balances }: { balances: LeaveBalanceView[] }) {
  if (balances.length === 0) {
    return (
      <Card className="px-[18px] py-4 text-[13px] text-text-faint">
        Aucun solde provisionné pour cette année pour l&apos;instant.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {balances.map((balance) => (
        <Card key={balance.id} className="border-l-[3px] border-l-sage px-[18px] py-4">
          <div className="mb-2 text-xs font-semibold text-text-muted">{balance.leaveTypeName}</div>
          <div className="font-heading text-[26px] font-extrabold">{balance.remainingDays}</div>
          <div className="mt-1 text-[11.5px] text-text-faint">
            jours restants sur {balance.totalDays} ({balance.usedDays} pris)
          </div>
        </Card>
      ))}
    </div>
  );
}
