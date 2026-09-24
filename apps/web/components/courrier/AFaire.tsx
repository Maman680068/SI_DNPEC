'use client';

import type { Acte, Arrivee } from '../../lib/courrier/types';
import type { Rubrique } from './CompteursCourrier';
import { LigneActe, LigneArrivee, LigneImputation, Vide, enRetard } from './Lignes';

type Section = { cle: Rubrique; titre: string; contenu: React.ReactNode[] };

/**
 * « À faire » : ce qui attend la personne (ou le titulaire en intérim), tiré des
 * listes et de leurs `droits` — exactement ce que compte le tableau de bord
 * (GET /courrier/tableau-de-bord repose sur les mêmes droits).
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

  const sections: Section[] = [
    {
      cle: 'aImputer',
      titre: 'À imputer',
      contenu: arrivees
        .filter((a) => a.statut === 'ENREGISTRE' && a.droits.imputer)
        .map((a) => <LigneArrivee key={a.id} a={a} unite={unite} onOpen={() => ouvrirArrivee(a.id)} />),
    },
    { cle: 'aTraiter', titre: 'À traiter', contenu: imp(aTraiter) },
    { cle: 'enRetard', titre: 'En retard', contenu: imp(aTraiter.filter(({ i }) => enRetard(i))) },
    { cle: 'aViser', titre: 'À viser', contenu: act((x) => x.droits.viser) },
    { cle: 'aSigner', titre: 'À signer', contenu: act((x) => x.droits.signer) },
    { cle: 'aExpedier', titre: 'À expédier', contenu: act((x) => x.droits.expedier) },
    { cle: 'priseDeConnaissance', titre: 'À prendre en connaissance', contenu: act((x) => x.droits.prendreConnaissance) },
    { cle: 'brouillons', titre: 'Brouillons à reprendre', contenu: act((x) => x.droits.modifier) },
  ];

  // Une rubrique choisie (compteur cliqué) : elle seule. Sinon toutes les
  // rubriques non vides — « En retard » est déjà contenu dans « À traiter ».
  const visibles = rubrique ? sections.filter((s) => s.cle === rubrique) : sections.filter((s) => s.cle !== 'enRetard' && s.contenu.length > 0);
  if (visibles.length === 0 || visibles.every((s) => s.contenu.length === 0)) {
    return <Vide>{rubrique ? 'Rien dans cette rubrique.' : 'Rien ne vous attend dans le courrier.'}</Vide>;
  }
  return (
    <div className="space-y-6">
      {visibles.map((s) => (
        <section key={s.cle} data-rubrique={s.cle}>
          <h2 className="mb-2.5 text-[15px] font-extrabold">
            {s.titre} <span className="font-semibold text-text-faint">({s.contenu.length})</span>
          </h2>
          {s.contenu.length === 0 ? <Vide>Rien dans cette rubrique.</Vide> : <div className="space-y-2">{s.contenu}</div>}
        </section>
      ))}
    </div>
  );
}
