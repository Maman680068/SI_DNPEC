'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getModeles } from '../../../lib/api/modelisation';
import type { ListeModeles } from '../../../lib/modelisation/types';
import { BTN_PRINCIPAL, EnTetePage, EtatVide, LigneTableau, Pastille, Tableau } from '../../../components/ui/Charte';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { SqueletteListe } from '../../../components/ui/Squelette';
import { FenetreDepot } from '../../../components/modelisation/FenetreDepot';
import { TON_VERSION } from '../../../components/modelisation/ListeControles';
import { useNavigation } from '../../../lib/navigation/NavigationProvider';

const GRILLE = 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_100px_minmax(0,1fr)_130px_minmax(0,1fr)_minmax(0,1.2fr)_120px]';
/** Ton de la colonne « Contrôles » (état de la version active, calculé par l'API). */
const TON_CONTROLES: Record<string, 'vert' | 'ambre' | 'rouge' | 'gris'> = { CONFORME: 'vert', ALERTE: 'ambre', AVEC_DEROGATION: 'rouge', SANS_VERSION_ACTIVE: 'gris' };
const ETAPES = [
  ['Préparer le paquet', 'Le modèle (code Python), ses données et ses résultats de référence, réunis dans un fichier .zip.'],
  ['Déposer', '« Déposer un modèle » : la plateforme lit le paquet et lance seule tous les contrôles.'],
  ['Régler les manettes', 'Ce que les analystes pourront faire varier, avec leurs bornes, et ce qu’ils liront.'],
  ['Faire approuver', 'Le responsable du modèle vérifie et active la version. Elle devient la seule qui fait foi.'],
];

const dateCourte = (iso: string) => {
  const d = new Date(iso);
  const auj = new Date();
  return d.toDateString() === auj.toDateString() ? 'aujourd’hui' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/** Modèles (domaine B, lot B1, maquette mod-1) : référentiel de la DNPEC, une seule version active par modèle. */
export default function ModelesPage() {
  const router = useRouter();
  const { rafraichir } = useNavigation();
  const [donnees, setDonnees] = useState<ListeModeles | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [depot, setDepot] = useState(false);

  const charger = useCallback(() => {
    getModeles()
      .then((d) => {
        setDonnees(d);
        setErreur(null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(charger, [charger]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <EnTetePage
        titre="Modèles"
        sousTitre="Référentiel de la DNPEC · une seule version active par modèle"
        actions={
          donnees?.droits.peutDeposer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setDepot(true)}>
              <Plus aria-hidden size={17} /> Déposer un modèle
            </button>
          )
        }
      />
      <ErreurChargement message={erreur} />
      {!donnees && !erreur && <SqueletteListe lignes={3} colonnes={5} />}
      {donnees && (
        <Tableau
          label="Modèles"
          testid="liste-modeles"
          grille={GRILLE}
          colonnes={['Modèle', 'Famille', 'Version active', 'Base de référence', 'Contrôles', 'Responsable', 'État', 'Dernier contrôle']}
          vide={<EtatVide texte="Aucun modèle au référentiel." />}
        >
          {donnees.modeles.map((m) => (
            <LigneTableau key={m.id} grille={GRILLE} testid="ligne-modele" label={m.nom} onClick={() => router.push(`/modelisation/${m.id}`)}>
              <div>
                <div className="font-bold text-ink-900">{m.nom}</div>
                <div className="text-[12.5px] text-text-muted">{m.sousTitre || m.code}</div>
              </div>
              <span>{m.famille}</span>
              <span>{m.versionActive ? `v${m.versionActive.numero}${m.versionActive.avecDerogation ? ' (dérogation)' : ''}` : '—'}</span>
              <span className={m.baseReference ? '' : 'text-text-muted'} data-testid="base-reference">{m.baseReference ?? '—'}</span>
              <span data-testid="controles-modele">
                <Pastille ton={TON_CONTROLES[m.controles.code] ?? 'gris'}>{m.controles.libelle}</Pastille>
              </span>
              <span className={m.responsable ? '' : 'text-text-muted'}>{m.responsable ?? 'À désigner'}</span>
              <span className="flex flex-wrap gap-1.5">
                {m.etat && (
                  <Pastille ton={TON_VERSION[m.etat.ton] ?? 'gris'}>
                    {m.etat.code === 'ACTIVE' ? 'Active' : `v${m.etat.numero} · ${m.etat.libelle}`}
                  </Pastille>
                )}
                {m.demonstration && <Pastille ton="encre">Démonstration</Pastille>}
              </span>
              <span>{m.dernierControle ? `v${m.dernierControle.numero} · ${dateCourte(m.dernierControle.le)}` : '—'}</span>
            </LigneTableau>
          ))}
        </Tableau>
      )}

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Intégrer un modèle en quatre étapes">
        {ETAPES.map(([t, d], i) => (
          <li key={t} className="rounded-xl border border-line bg-surface px-4 py-4">
            <span aria-hidden className="mb-2.5 grid h-7 w-7 place-items-center rounded-full bg-ink text-[12.5px] font-bold text-white">
              {i + 1}
            </span>
            <h2 className="mb-1 text-[15px] font-bold text-ink-900">{t}</h2>
            <p className="text-[13px] leading-snug text-text-muted">{d}</p>
          </li>
        ))}
      </ol>

      {depot && (
        <FenetreDepot
          onClose={() => {
            setDepot(false);
            charger();
            rafraichir();
          }}
          onTermine={(id) => {
            setDepot(false);
            rafraichir();
            router.push(`/modelisation/${id}`);
          }}
        />
      )}
    </div>
  );
}
