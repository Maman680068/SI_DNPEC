'use client';

import type { ReactNode } from 'react';
import type { Acte, Arrivee } from '../../lib/courrier/types';
import { EtatVide, Tableau } from '../ui/Charte';
import type { Rubrique } from './CompteursCourrier';
import {
  COLONNES_ACTES,
  COLONNES_ARRIVEES,
  COLONNES_IMPUTATIONS,
  GRILLE_ACTES,
  GRILLE_ARRIVEES,
  GRILLE_IMPUTATIONS,
  LigneActe,
  LigneArrivee,
  LigneImputation,
  enRetard,
} from './Lignes';

type Section = { cle: Rubrique; titre: string; colonnes: string[]; grille: string; contenu: ReactNode[] };

/**
 * « À faire » : ce qui attend la personne (ou le titulaire en intérim), tiré des
 * listes et de leurs `droits` — exactement ce que compte le tableau de bord
 * (GET /courrier/tableau-de-bord repose sur les mêmes droits). Une rubrique par tableau.
 */
export function AFaire({
  arrivees,
  actes,
  rubrique,
  unite,
  ouvrirArrivee,
  ouvrirActe,
}: {
  arrivees: Arrivee[];
  actes: Acte[];
  rubrique: Rubrique | null;
  unite: (key: string) => string;
  ouvrirArrivee: (id: string) => void;
  ouvrirActe: (id: string) => void;
}) {
  const aTraiter = arrivees.flatMap((a) => a.imputations.filter((i) => i.droits.traiter).map((i) => ({ a, i })));
  const imp = (liste: typeof aTraiter) => liste.map(({ a, i }) => <LigneImputation key={i.id} a={a} i={i} onOpen={() => ouvrirArrivee(a.id)} />);
  const act = (f: (x: Acte) => boolean) => actes.filter(f).map((x) => <LigneActe key={x.id} a={x} onOpen={() => ouvrirActe(x.id)} />);
  const tActes = { colonnes: COLONNES_ACTES, grille: GRILLE_ACTES };
  const tImp = { colonnes: COLONNES_IMPUTATIONS, grille: GRILLE_IMPUTATIONS };

  const sections: Section[] = [
    {
      cle: 'aImputer',
      titre: 'À imputer',
      colonnes: COLONNES_ARRIVEES,
      grille: GRILLE_ARRIVEES,
      contenu: arrivees
        .filter((a) => a.statut === 'ENREGISTRE' && a.droits.imputer)
        .map((a) => <LigneArrivee key={a.id} a={a} unite={unite} onOpen={() => ouvrirArrivee(a.id)} />),
    },
    { cle: 'aTraiter', titre: 'À traiter', ...tImp, contenu: imp(aTraiter) },
    { cle: 'enRetard', titre: 'En retard', ...tImp, contenu: imp(aTraiter.filter(({ i }) => enRetard(i))) },
    { cle: 'aViser', titre: 'À viser', ...tActes, contenu: act((x) => x.droits.viser) },
    { cle: 'aSigner', titre: 'À signer', ...tActes, contenu: act((x) => x.droits.signer) },
    { cle: 'aExpedier', titre: 'À expédier', ...tActes, contenu: act((x) => x.droits.expedier) },
    { cle: 'priseDeConnaissance', titre: 'À prendre en connaissance', ...tActes, contenu: act((x) => x.droits.prendreConnaissance) },
    { cle: 'brouillons', titre: 'Brouillons à reprendre', ...tActes, contenu: act((x) => x.droits.modifier) },
  ];

  // Une rubrique choisie (compteur cliqué) : elle seule. Sinon toutes les
  // rubriques non vides — « En retard » est déjà contenu dans « À traiter ».
  const visibles = rubrique ? sections.filter((s) => s.cle === rubrique) : sections.filter((s) => s.cle !== 'enRetard' && s.contenu.length > 0);
  if (visibles.length === 0 || visibles.every((s) => s.contenu.length === 0)) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EtatVide texte={rubrique ? 'Rien dans cette rubrique.' : 'Rien ne vous attend dans le courrier.'} />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {visibles.map((s) => (
        <section key={s.cle} data-rubrique={s.cle} aria-label={s.titre}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-[15.5px] font-bold text-ink-900">
            {s.titre} <span className="font-sans text-[13px] font-semibold text-text-faint">{s.contenu.length}</span>
          </h2>
          <Tableau label={s.titre} colonnes={s.colonnes} grille={s.grille} vide={<EtatVide texte="Rien dans cette rubrique." />}>
            {s.contenu}
          </Tableau>
        </section>
      ))}
    </div>
  );
}
