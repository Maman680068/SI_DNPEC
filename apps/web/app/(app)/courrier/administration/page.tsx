'use client';

import { useState } from 'react';
import { useAuth } from '../../../../lib/auth/AuthProvider';
import { PanneauCompteurs, PanneauHabilitations, PanneauRegistres } from '../../../../components/courrier/Administration';
import { EnTetePage, Onglets } from '../../../../components/ui/Charte';

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
      <EnTetePage titre="Courrier — paramétrage" sousTitre="Registres et gabarits de numérotation, habilitations du secrétariat, compteurs" />
      <Onglets label="Paramétrage du courrier" onglets={ONGLETS.map((o) => ({ cle: o.cle, label: o.libelle }))} actif={onglet} onChange={setOnglet} />
      {onglet === 'registres' && <PanneauRegistres />}
      {onglet === 'habilitations' && <PanneauHabilitations />}
      {onglet === 'compteurs' && <PanneauCompteurs />}
    </div>
  );
}
