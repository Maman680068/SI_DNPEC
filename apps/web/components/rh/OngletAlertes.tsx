'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAlertesRh } from '../../lib/api/rh';
import type { AlerteRh, TypeAlerteRh } from '../../lib/rh/types';
import { BandeCompteurs, BarreOutils, BTN_LIGNE, EtatVide, FiltreSelect, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const TON = { HAUTE: 'rouge', MOYENNE: 'ambre', BASSE: 'gris' } as const;
const PRIORITE = { HAUTE: 'Urgente', MOYENNE: 'À traiter', BASSE: 'À compléter' } as const;
const TYPE: Record<TypeAlerteRh, string> = {
  FIN_CONTRAT: 'Fin de contrat',
  FIN_STAGE: 'Fin de stage',
  AVANCEMENT_ECHELON: 'Avancement d’échelon',
  DOSSIER_INCOMPLET: 'Dossier incomplet',
};
const GRILLE = 'lg:grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)_110px_90px]';

/** Alertes RH (A3.5) : produites à chaque lecture, elles disparaissent quand leur cause disparaît. */
export function OngletAlertes({ typeInitial = '' }: { typeInitial?: TypeAlerteRh | '' }) {
  const [a, setA] = useState<AlerteRh[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [type, setType] = useState<TypeAlerteRh | ''>(typeInitial);
  useEffect(() => {
    getAlertesRh().then(setA).catch((x) => setErreur(messageChargement(x)));
  }, []);
  if (!a) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  if (!a.length) return <div className="rounded-xl border border-line bg-surface"><EtatVide texte="Aucune alerte : dossiers complets, aucune échéance proche." /></div>;
  const n = (t: TypeAlerteRh) => a.filter((x) => x.type === t).length;
  const affichees = type ? a.filter((x) => x.type === type) : a;
  return (
    <div>
      <BandeCompteurs
        label="Alertes par nature"
        items={(Object.keys(TYPE) as TypeAlerteRh[]).map((t) => ({
          valeur: n(t),
          label: TYPE[t],
          ton: n(t) ? (t === 'FIN_CONTRAT' || t === 'FIN_STAGE' ? 'rouge' : 'ambre') : 'gris',
          onClick: () => setType(type === t ? '' : t),
          actif: type === t,
        }))}
      />
      <BarreOutils>
        <FiltreSelect<TypeAlerteRh | ''>
          label="Nature de l’alerte"
          value={type}
          defaut=""
          onChange={setType}
          options={[{ value: '', label: 'Toutes les alertes' }, ...(Object.keys(TYPE) as TypeAlerteRh[]).map((t) => ({ value: t, label: TYPE[t] }))]}
        />
      </BarreOutils>
      <Tableau
        label="Alertes RH"
        testid="alertes-rh"
        grille={GRILLE}
        colonnes={['Priorité', 'Personne', 'Alerte', 'Échéance', <span key="a" className="sr-only">Actions</span>]}
        vide={<EtatVide texte="Aucune alerte de cette nature." action={<button type="button" className={BTN_LIGNE} onClick={() => setType('')}>Voir toutes les alertes</button>} />}
        pied={<span>Alertes calculées à chaque lecture : elles disparaissent quand leur cause disparaît.</span>}
      >
        {affichees.map((x) => (
          <LigneTableau key={x.cle} grille={GRILLE} testid="alerte-rh">
            <Pastille ton={TON[x.priorite]}>{PRIORITE[x.priorite]}</Pastille>
            <b className="block truncate font-semibold text-ink-900">{x.nom}</b>
            <span className="block">
              <span className="block font-semibold">{x.libelle}</span>
              <small className="block text-[12px] text-text-muted">{x.detail}</small>
            </span>
            <span className="text-text-muted">{x.echeance ? new Date(x.echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
            <span className="flex lg:justify-end">
              <Link href={x.lien} className={BTN_LIGNE} aria-label={`Voir : ${x.libelle} — ${x.nom}`}>
                Voir
              </Link>
            </span>
          </LigneTableau>
        ))}
      </Tableau>
    </div>
  );
}
