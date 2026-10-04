'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { exporterDemandes, getTableauLogistique } from '../../../lib/api/logistique';
import type { Bien, TableauLogistique } from '../../../lib/logistique/types';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { SquelettePage } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';
import { BTN_PRINCIPAL, BTN_SECONDAIRE, BandeCompteurs, EnTetePage, Onglets, type Compteur, type Onglet as OngletCharte } from '../../../components/ui/Charte';
import { OngletDemandes, type VueDemandes } from '../../../components/logistique/OngletDemandes';
import { OngletReservations } from '../../../components/logistique/OngletReservations';
import { OngletBiens } from '../../../components/logistique/OngletBiens';
import { OngletFournitures } from '../../../components/logistique/OngletFournitures';
import { OngletVehicules } from '../../../components/logistique/OngletVehicules';

type Onglet = 'demandes' | 'reservations' | 'inventaire' | 'fournitures' | 'vehicules';
const ONGLETS: Onglet[] = ['demandes', 'reservations', 'inventaire', 'fournitures', 'vehicules'];
const jourMois = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Logistique (D9 ; refonte de l'interface, étape 7) : bande de compteurs selon le rôle (gestionnaire :
 * file à traiter, réservations du jour, stock bas, véhicules ; autres : ce qui les concerne), onglets
 * à compteur, demandes en tableau. Liens profonds : ?id=<demande>, ?onglet=reservations&reservation=<id>,
 * ?onglet=inventaire&id=<bien>, ?onglet=fournitures&id=<article>, ?vue=a_valider|a_traiter|miennes.
 */
export default function LogistiquePage() {
  const toast = useToast();
  const [tableau, setTableau] = useState<TableauLogistique | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('demandes');
  const [lien, setLien] = useState<{ id: string | null; reservation: string | null; onglet: string | null }>({ id: null, reservation: null, onglet: null });
  const [vue, setVue] = useState<VueDemandes | null>(null);
  const [creation, setCreation] = useState<Bien | true | null>(null);
  const vueDemandee = useRef<string | null>(null);

  const charger = useCallback(() => {
    getTableauLogistique()
      .then((t) => {
        setTableau(t);
        setErreur(null);
        // Vue des demandes à l'ouverture : celle demandée par le lien, sinon ce qui attend la personne.
        setVue(
          (v) =>
            v ??
            (['miennes', 'a_valider', 'a_traiter'].includes(vueDemandee.current ?? '') && (vueDemandee.current !== 'a_traiter' || t.gestionnaire)
              ? (vueDemandee.current as VueDemandes)
              : t.gestionnaire && t.aTraiter > 0
                ? 'a_traiter'
                : t.aValider > 0
                  ? 'a_valider'
                  : 'miennes'),
        );
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    vueDemandee.current = p.get('vue');
    const o = p.get('onglet') as Onglet | null;
    if (o && ONGLETS.includes(o)) setOnglet(o);
    setLien({ id: p.get('id'), reservation: p.get('reservation'), onglet: o });
    charger();
  }, [charger]);

  if (!tableau || !vue)
    return erreur ? (
      <div>
        <EnTetePage titre="Logistique" />
        <ErreurChargement message={erreur} />
      </div>
    ) : (
      <SquelettePage />
    );
  const g = tableau.gestionnaire;
  const v = tableau.vehicules;
  const aller = (o: Onglet, vueDemandes?: VueDemandes) => () => {
    setOnglet(o);
    if (vueDemandes) setVue(vueDemandes);
  };

  const vehicules: Compteur = {
    valeur: `${v.disponibles} / ${v.total}`,
    label: 'Véhicules disponibles',
    sous: v.enMission ? `${v.enMission} en mission${v.retourLe ? ` jusqu’au ${jourMois(v.retourLe)}` : ''}` : 'aucun en mission',
    onClick: aller('vehicules'),
    actif: onglet === 'vehicules',
    testid: 'compteur-vehicules',
  };
  const compteurs: Compteur[] = g
    ? [
        { valeur: tableau.aTraiter, label: 'Demandes à traiter', sous: 'validées par les chefs', ton: tableau.aTraiter ? 'ambre' : 'encre', onClick: aller('demandes', 'a_traiter'), actif: onglet === 'demandes' && vue === 'a_traiter', testid: 'compteur-a-traiter' },
        { valeur: tableau.reservationsDuJour, label: 'Réservations aujourd’hui', sous: 'salles et matériel', onClick: aller('reservations'), actif: onglet === 'reservations', testid: 'compteur-reservations' },
        {
          valeur: tableau.stockBas,
          label: 'Fournitures sous le seuil',
          sous: tableau.stockBas ? `${tableau.stockBasLibelles.join(', ')}${tableau.stockBas > tableau.stockBasLibelles.length ? '…' : ''}` : 'aucun article',
          ton: tableau.stockBas ? 'rouge' : 'encre',
          onClick: aller('fournitures'),
          actif: onglet === 'fournitures',
          testid: 'compteur-stock',
        },
        vehicules,
      ]
    : [
        { valeur: tableau.mesDemandesEnCours, label: 'Mes demandes en cours', sous: 'en attente ou en traitement', onClick: aller('demandes', 'miennes'), actif: onglet === 'demandes' && vue === 'miennes', testid: 'compteur-mes-demandes' },
        ...(tableau.aValider > 0
          ? [{ valeur: tableau.aValider, label: 'Demandes à valider', sous: 'de votre équipe', ton: 'ambre' as const, onClick: aller('demandes', 'a_valider'), actif: onglet === 'demandes' && vue === 'a_valider', testid: 'compteur-a-valider' }]
          : []),
        { valeur: tableau.reservationsDuJour, label: 'Mes réservations aujourd’hui', sous: 'salles et matériel', onClick: aller('reservations'), actif: onglet === 'reservations', testid: 'compteur-reservations' },
        vehicules,
      ];

  const onglets: OngletCharte<Onglet>[] = [
    { cle: 'demandes', label: 'Demandes', n: tableau.aValider + (g ? tableau.aTraiter : 0), chaud: true },
    { cle: 'reservations', label: 'Réservations', n: tableau.reservationsAValider, chaud: true },
    { cle: 'inventaire', label: g ? 'Inventaire' : 'Mes biens' },
    ...(g ? [{ cle: 'fournitures' as Onglet, label: 'Fournitures', n: tableau.stockBas, chaud: true }] : []),
    { cle: 'vehicules', label: 'Véhicules' },
  ];

  return (
    <div>
      <EnTetePage
        titre="Logistique"
        sousTitre={g ? 'Gestionnaire logistique' : undefined}
        actions={
          <>
            {onglet === 'demandes' && (
              <button type="button" className={BTN_SECONDAIRE} onClick={() =>
                  void exporterDemandes(vue)
                    .then(() => toast.succes('Demandes exportées', { detail: 'Fichier Excel téléchargé.' }))
                    .catch((e) => toast.erreur('Export impossible', messageErreur(e)))
                }>
                <FileSpreadsheet aria-hidden size={16} />
                Exporter
              </button>
            )}
            <button
              type="button"
              className={BTN_PRINCIPAL}
              onClick={() => {
                setOnglet('demandes');
                setCreation(true);
              }}
            >
              <Plus aria-hidden size={17} />
              Nouvelle demande
            </button>
          </>
        }
      />
      <ErreurChargement message={erreur} />
      <BandeCompteurs label="Logistique en un coup d’œil" items={compteurs} />
      <Onglets label="Rubriques logistiques" onglets={onglets} actif={onglet} onChange={setOnglet} />
      {onglet === 'demandes' && (
        <OngletDemandes
          gestionnaire={g}
          ouvrirId={lien.id && !lien.reservation && (!lien.onglet || lien.onglet === 'demandes') ? lien.id : null}
          vue={vue}
          onVue={setVue}
          creation={creation}
          onCreation={setCreation}
          onChange={charger}
        />
      )}
      {onglet === 'reservations' && <OngletReservations gestionnaire={g} ouvrirId={lien.reservation} onChange={charger} />}
      {onglet === 'inventaire' && (
        <OngletBiens
          gestionnaire={g}
          ouvrirId={lien.id}
          onSignaler={(b) => {
            setCreation(b);
            setOnglet('demandes');
          }}
        />
      )}
      {onglet === 'fournitures' && g && <OngletFournitures ouvrirId={lien.id} />}
      {onglet === 'vehicules' && <OngletVehicules />}
    </div>
  );
}
