'use client';

import { useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { DivisionsPanel } from '../../../components/organisation/DivisionsPanel';
import { CellulesPanel } from '../../../components/organisation/CellulesPanel';
import { Organigramme } from '../../../components/socle/Organigramme';
import { EnTetePage, Onglets } from '../../../components/ui/Charte';

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
      <EnTetePage titre="Organisation" sousTitre="Unités, responsables et effectifs de la DNPEC" />

      {onglets.length > 1 && <Onglets label="Organisation" actif={tab} onChange={setTab} onglets={onglets.map((o) => ({ cle: o.key, label: o.label }))} />}

      {tab === 'organigramme' && <Organigramme />}
      {tab === 'divisions' && admin && <DivisionsPanel />}
      {tab === 'cellules' && admin && <CellulesPanel />}
    </div>
  );
}
