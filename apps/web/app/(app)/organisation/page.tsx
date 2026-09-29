'use client';

import { useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { DivisionsPanel } from '../../../components/organisation/DivisionsPanel';
import { CellulesPanel } from '../../../components/organisation/CellulesPanel';
import { Organigramme } from '../../../components/socle/Organigramme';

type Tab = 'organigramme' | 'divisions' | 'cellules';

/**
 * Organisation (socle NIMBA, §3) : l'organigramme est lisible par tous et géré
 * par le DRH et l'administrateur (droits renvoyés par l'API). Les onglets
 * historiques (suspension, nomination des chefs de cellule) restent réservés à
 * l'administrateur.
 */
export default function OrganisationPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('organigramme');
  const admin = currentUser?.role === 'ADMIN_SYSTEME';
  const onglets = [
    { key: 'organigramme', label: 'Organigramme' },
    ...(admin ? [{ key: 'divisions', label: 'Divisions & Sections' }, { key: 'cellules', label: 'Cellules' }] : []),
  ] as { key: Tab; label: string }[];

  return (
    <div>
      <div className="mb-[22px]">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
        <h1 className="text-[22px] font-extrabold">Organisation</h1>
      </div>

      {onglets.length > 1 && (
        <div role="tablist" className="mb-4 flex max-w-full flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
          {onglets.map((option) => (
            <button
              key={option.key}
              role="tab"
              aria-selected={tab === option.key}
              onClick={() => setTab(option.key)}
              className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${tab === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'organigramme' && <Organigramme />}
      {tab === 'divisions' && admin && <DivisionsPanel />}
      {tab === 'cellules' && admin && <CellulesPanel />}
    </div>
  );
}
