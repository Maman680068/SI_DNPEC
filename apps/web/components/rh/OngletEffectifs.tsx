'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { getEffectifs } from '../../lib/api/rh';
import type { AlerteRh, Effectifs, Repartition, TypeAlerteRh } from '../../lib/rh/types';
import { BandeCompteurs, EtatVide } from '../ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const nombre = (n: number) => n.toLocaleString('fr-FR');

/** Panneau de la maquette (`.pn.bx`) : titre Montserrat 15 px, sans bandeau d'en-tête. */
function Bloc({ titre, compteur, children, testid }: { titre: string; compteur?: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <section aria-label={titre} data-testid={testid} className="min-w-0 rounded-xl border border-line bg-surface px-4 py-3.5">
      <h2 className="mb-2.5 flex items-center justify-between gap-2 font-heading text-[15px] font-bold text-ink-900">
        {titre}
        {compteur}
      </h2>
      {children}
    </section>
  );
}

/**
 * Répartition en barres (maquette `.br` : libellé, barre de 120 px, nombre). Barre relative au plus grand
 * nombre. Au-delà de `limite` lignes, les suivantes se déplient (aucun panneau démesuré).
 */
function Barres({ lignes, label, limite = 8 }: { lignes: Repartition[]; label: string; limite?: number }) {
  const [tout, setTout] = useState(false);
  if (lignes.length === 0) return <p className="py-2 text-[13px] text-text-muted">Aucune donnée renseignée dans les dossiers.</p>;
  const max = Math.max(...lignes.map((l) => l.nombre), 1);
  const visibles = tout ? lignes : lignes.slice(0, limite);
  return (
    <>
      <ul aria-label={label}>
        {visibles.map((l) => (
          <li key={l.libelle} className="grid grid-cols-[minmax(0,1fr)_minmax(60px,120px)_32px] items-center gap-2.5 py-[5px] text-[13px]">
            <span className="min-w-0 break-words">{l.libelle}</span>
            <span aria-hidden className="block h-[5px] overflow-hidden rounded-[3px] bg-fond-gris">
              <span className="block h-full rounded-[3px] bg-ink" style={{ width: `${Math.round((l.nombre / max) * 100)}%` }} />
            </span>
            <b className="text-right font-semibold text-ink-900">{nombre(l.nombre)}</b>
          </li>
        ))}
      </ul>
      {lignes.length > limite && (
        <button type="button" onClick={() => setTout(!tout)} aria-expanded={tout} className="mt-1.5 rounded text-[12.5px] font-semibold text-ink hover:underline">
          {tout ? 'Réduire la liste' : `Afficher les ${lignes.length - limite} autres`}
        </button>
      )}
    </>
  );
}

const PRIORITE: Record<AlerteRh['priorite'], number> = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };
const POINT: Record<AlerteRh['priorite'] | 'INFO', string> = { HAUTE: 'bg-clay', MOYENNE: 'bg-ambre-vif', BASSE: 'bg-ink', INFO: 'bg-ink' };
const LIBELLE_GROUPE: Record<TypeAlerteRh, (n: number) => string> = {
  AVANCEMENT_ECHELON: (n) => `${n} avancement${n > 1 ? 's' : ''} d’échelon à instruire`,
  FIN_CONTRAT: (n) => `${n} fin${n > 1 ? 's' : ''} de contrat à échéance`,
  FIN_STAGE: (n) => `${n} fin${n > 1 ? 's' : ''} de stage à échéance`,
  DOSSIER_INCOMPLET: (n) => `${n} dossier${n > 1 ? 's' : ''} incomplet${n > 1 ? 's' : ''}`,
};

/** Alertes RH regroupées par nature (DRH seul : la liste vient de GET api/v1/rh/alertes). */
function BlocAlertes({ alertes, matriculesProvisoires, onVoir }: { alertes: AlerteRh[]; matriculesProvisoires: number; onVoir: (type: TypeAlerteRh) => void }) {
  const groupes = (Object.keys(LIBELLE_GROUPE) as TypeAlerteRh[])
    .map((type) => {
      const liste = alertes.filter((a) => a.type === type);
      const priorite = liste.reduce<AlerteRh['priorite']>((p, a) => (PRIORITE[a.priorite] < PRIORITE[p] ? a.priorite : p), 'BASSE');
      return { type, n: liste.length, priorite };
    })
    .filter((g) => g.n > 0)
    .sort((a, b) => PRIORITE[a.priorite] - PRIORITE[b.priorite]);
  return (
    <Bloc
      titre="Alertes RH"
      testid="effectifs-alertes"
      compteur={<span className="inline-flex h-[22px] items-center rounded-[6px] bg-clay-50 px-2 text-[12px] font-semibold text-clay">{alertes.length}</span>}
    >
      {groupes.length === 0 && matriculesProvisoires === 0 ? (
        <EtatVide texte="Aucune alerte : dossiers complets, aucune échéance proche." />
      ) : (
        <ul>
          {groupes.map((g) => (
            <li key={g.type} className="flex items-center gap-2.5 border-t border-line-doux py-[9px] text-[13px] first:border-t-0">
              <span aria-hidden className={`h-[9px] w-[9px] flex-none rounded-full ${POINT[g.priorite]}`} />
              <span className="min-w-0 flex-1">{LIBELLE_GROUPE[g.type](g.n)}</span>
              <button type="button" onClick={() => onVoir(g.type)} className="rounded text-[12.5px] font-semibold text-text-muted hover:text-ink hover:underline" aria-label={`Voir : ${LIBELLE_GROUPE[g.type](g.n)}`}>
                Voir
              </button>
            </li>
          ))}
          {matriculesProvisoires > 0 && (
            <li className="flex items-center gap-2.5 border-t border-line-doux py-[9px] text-[13px] first:border-t-0">
              <span aria-hidden className={`h-[9px] w-[9px] flex-none rounded-full ${POINT.INFO}`} />
              <span className="min-w-0 flex-1">
                {matriculesProvisoires} matricule{matriculesProvisoires > 1 ? 's' : ''} provisoire{matriculesProvisoires > 1 ? 's' : ''}
              </span>
              <Link href="/agents?matriculeProvisoire=true" className="rounded text-[12.5px] font-semibold text-text-muted hover:text-ink hover:underline" aria-label={`Voir les ${matriculesProvisoires} matricule(s) provisoire(s)`}>
                Voir
              </Link>
            </li>
          )}
        </ul>
      )}
    </Bloc>
  );
}

/**
 * Effectifs (A3.5, maquette « apres-effectifs ») : bande de 4 indicateurs, répartition par unité, par
 * statut et catégorie, alertes RH regroupées (DRH seul). Tout est calculé à la lecture par l'API.
 */
export function OngletEffectifs({ alertes, onVoirAlertes }: { alertes: AlerteRh[] | null; onVoirAlertes: (type: TypeAlerteRh) => void }) {
  const [e, setE] = useState<Effectifs | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getEffectifs().then(setE).catch((x) => setErreur(messageChargement(x)));
  }, []);
  if (!e) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const calcule = new Date(e.calculeLe);
  return (
    <div data-testid="effectifs">
      <BandeCompteurs
        label="Indicateurs des effectifs"
        items={[
          { valeur: nombre(e.total), label: 'Agents en fonction', sous: 'hors départs confirmés', testid: 'indicateur-total' },
          {
            valeur: e.ancienneteMoyenneAnnees !== null ? `${e.ancienneteMoyenneAnnees.toLocaleString('fr-FR')} ans` : '—',
            label: 'Ancienneté moyenne',
            sous: `sur ${nombre(e.ancienneteRenseignee)} date${e.ancienneteRenseignee > 1 ? 's' : ''} renseignée${e.ancienneteRenseignee > 1 ? 's' : ''}`,
            testid: 'indicateur-anciennete',
          },
          {
            valeur: e.partFemmes !== null ? `${Math.round(e.partFemmes)} %` : '—',
            label: 'Part des femmes',
            sous: `sur ${nombre(e.genreRenseigne)} genre${e.genreRenseigne > 1 ? 's' : ''} renseigné${e.genreRenseigne > 1 ? 's' : ''}`,
            testid: 'indicateur-femmes',
          },
          {
            valeur: nombre(e.departsPrevus),
            label: 'Départs prévus',
            sous: `fins de contrat ou de stage, ${e.departsHorizonMois} mois`,
            ton: e.departsPrevus > 0 ? 'rouge' : 'encre',
            testid: 'indicateur-departs',
          },
        ]}
      />
      <div className={`grid grid-cols-1 gap-4 ${alertes ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <Bloc titre="Par unité">
          <Barres lignes={e.parUnite} label="Agents par unité" />
        </Bloc>
        <Bloc titre="Par statut et catégorie">
          <Barres lignes={e.parStatutCategorie} label="Agents par statut et catégorie" />
        </Bloc>
        {alertes && <BlocAlertes alertes={alertes} matriculesProvisoires={e.matriculesProvisoires} onVoir={onVoirAlertes} />}
      </div>
      <p className="mt-3 text-[12.5px] text-text-muted">
        Calculé le {calcule.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à {calcule.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à partir des dossiers ; rien n’est saisi ici.
      </p>
    </div>
  );
}
