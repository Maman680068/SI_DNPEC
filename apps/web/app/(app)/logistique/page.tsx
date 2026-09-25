'use client';

import { useCallback, useEffect, useState } from 'react';
import { getTableauLogistique } from '../../../lib/api/logistique';
import type { Bien, TableauLogistique } from '../../../lib/logistique/types';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { SousOnglets } from '../../../components/logistique/commun';
import { OngletDemandes } from '../../../components/logistique/OngletDemandes';
import { OngletReservations } from '../../../components/logistique/OngletReservations';
import { OngletBiens } from '../../../components/logistique/OngletBiens';
import { OngletFournitures } from '../../../components/logistique/OngletFournitures';

type Onglet = 'demandes' | 'reservations' | 'inventaire' | 'fournitures';

/** Logistique (D9) : demandes, réservations, biens ; fournitures pour les gestionnaires.
 * Liens profonds : ?id=<demande>, ?onglet=reservations&reservation=<id>,
 * ?onglet=inventaire&id=<bien>, ?onglet=fournitures&id=<article>. */
export default function LogistiquePage() {
  const [tableau, setTableau] = useState<TableauLogistique | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('demandes');
  const [lien, setLien] = useState<{ id: string | null; reservation: string | null }>({ id: null, reservation: null });
  const [intervention, setIntervention] = useState<Bien | null>(null);

  const charger = useCallback(() => {
    getTableauLogistique()
      .then(setTableau)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    charger();
    const p = new URLSearchParams(window.location.search);
    const o = p.get('onglet') as Onglet | null;
    if (o && ['demandes', 'reservations', 'inventaire', 'fournitures'].includes(o)) setOnglet(o);
    setLien({ id: p.get('id'), reservation: p.get('reservation') });
  }, [charger]);

  if (!tableau) return <Chargement erreur={erreur} />;
  const g = tableau.gestionnaire;
  const badge = (n: number) => (n > 0 ? ` (${n})` : '');
  const options: { cle: Onglet; libelle: string }[] = [
    { cle: 'demandes', libelle: `Demandes${badge(tableau.aValider + (g ? tableau.aTraiter : 0))}` },
    { cle: 'reservations', libelle: `Réservations${badge(tableau.reservationsAValider)}` },
    { cle: 'inventaire', libelle: g ? 'Inventaire' : 'Mes biens' },
    ...(g ? [{ cle: 'fournitures' as Onglet, libelle: `Fournitures${badge(tableau.stockBas)}` }] : []),
  ];
  return (
    <div>
      <ErreurChargement message={erreur} />
      <div className="mb-[18px]">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
        <h1 className="text-[22px] font-extrabold">Logistique</h1>
        {g && <p className="mt-1 text-[12.5px] text-text-muted">Vous êtes gestionnaire logistique.</p>}
      </div>
      <SousOnglets valeur={onglet} options={options} onChange={setOnglet} />
      {onglet === 'demandes' && <OngletDemandes gestionnaire={g} ouvrirId={lien.id && !lien.reservation ? lien.id : null} nouvelleIntervention={intervention} onChange={charger} />}
      {onglet === 'reservations' && <OngletReservations gestionnaire={g} ouvrirId={lien.reservation} onChange={charger} />}
      {onglet === 'inventaire' && (
        <OngletBiens
          gestionnaire={g}
          ouvrirId={lien.id}
          onSignaler={(b) => {
            setIntervention(b);
            setOnglet('demandes');
          }}
        />
      )}
      {onglet === 'fournitures' && g && <OngletFournitures ouvrirId={lien.id} />}
    </div>
  );
}
