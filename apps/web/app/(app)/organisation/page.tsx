'use client';

import { useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { DivisionsPanel } from '../../../components/organisation/DivisionsPanel';
import { CellulesPanel } from '../../../components/organisation/CellulesPanel';

type Tab = 'divisions' | 'cellules';

export default function OrganisationPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('divisions');

  if (currentUser?.role !== 'ADMIN_SYSTEME') {
    return (
      <div className="py-16 text-center">
        <h1 className="mb-2 text-[19px] font-bold">Accès non autorisé</h1>
        <p className="text-[13.5px] text-text-muted">Cette page est réservée à l’Administrateur Système.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[22px]">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Administration</div>
        <h1 className="text-[22px] font-extrabold">Organisation</h1>
      </div>

      <div className="mb-4 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            { key: 'divisions', label: 'Divisions & Sections' },
            { key: 'cellules', label: 'Cellules' },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            onClick={() => setTab(option.key)}
            className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${
              tab === option.key ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'divisions' ? <DivisionsPanel /> : <CellulesPanel />}
    </div>
  );
}
