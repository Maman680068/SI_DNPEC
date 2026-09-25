'use client';

import { useState } from 'react';
import { useAuth } from '../../../../lib/auth/AuthProvider';
import { PanneauCompteurs, PanneauHabilitations, PanneauRegistres } from '../../../../components/courrier/Administration';

type Onglet = 'registres' | 'habilitations' | 'compteurs';
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'registres', libelle: 'Registres' },
  { cle: 'habilitations', libelle: 'Habilitations' },
  { cle: 'compteurs', libelle: 'Compteurs' },
];

/** Paramétrage du courrier (D7) — Administrateur Système uniquement (l'API le
 * vérifie aussi : @Roles(ADMIN_SYSTEME) sur chaque écriture). */
export default function AdministrationCourrierPage() {
  const { user } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('registres');

  if (user?.role !== 'ADMIN_SYSTEME') {
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
        <h1 className="text-[22px] font-extrabold">Courrier — paramétrage</h1>
        <p className="mt-1 max-w-[680px] text-[13px] text-text-muted">Registres et gabarits de numérotation, habilitations du secrétariat, compteurs.</p>
      </div>
      <div role="tablist" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            role="tab"
            aria-selected={onglet === o.cle}
            onClick={() => setOnglet(o.cle)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold ${
              onglet === o.cle ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-text-muted hover:text-ink'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      {onglet === 'registres' && <PanneauRegistres />}
      {onglet === 'habilitations' && <PanneauHabilitations />}
      {onglet === 'compteurs' && <PanneauCompteurs />}
    </div>
  );
}
