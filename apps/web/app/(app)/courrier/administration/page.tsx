'use client';

import { useAuth } from '../../../../lib/auth/AuthProvider';
import { ParametrageCourrierVue } from '../../../../components/courrier/Administration';
import { EnTetePage } from '../../../../components/ui/Charte';

/** Paramétrage du courrier (D7, S9c) — Administrateur Système uniquement (l'API le
 * vérifie aussi : @Roles(ADMIN_SYSTEME) sur chaque écriture et sur la vue d'ensemble). */
export default function AdministrationCourrierPage() {
  const { user } = useAuth();

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
      <EnTetePage titre="Courrier — paramétrage" sousTitre="Registres et numérotation, habilitations du secrétariat" />
      <ParametrageCourrierVue />
    </div>
  );
}
