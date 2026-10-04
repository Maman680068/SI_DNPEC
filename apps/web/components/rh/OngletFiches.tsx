'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { enregistrerFichePoste, getFichesPoste } from '../../lib/api/rh';
import type { FichePoste, Fiches } from '../../lib/rh/types';
import { FenetreDetail } from '../ui/FenetreDetail';
import { BarreOutils, BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, CleValeur, EtatVide, LigneTableau, Pastille, Recherche, SectionFenetre, Tableau } from '../ui/Charte';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'mt-1 w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] font-normal';

const GRILLE = 'lg:grid-cols-[minmax(0,1fr)_130px_130px_100px]';

/** Fiches de poste (SIG-RF-CAR-07) : rattachées à la fonction, jamais à la personne. */
export function OngletFiches() {
  const [l, setL] = useState<Fiches | null>(null);
  const [edition, setEdition] = useState<FichePoste | 'nouvelle' | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => getFichesPoste().then(setL).catch((x) => setErreur(messageChargement(x))), []);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const q = recherche.trim().toLowerCase();
  const fiches = q ? l.fiches.filter((f) => `${f.fonction} ${f.missions}`.toLowerCase().includes(q)) : l.fiches;
  const detail = ouverte ? l.fiches.find((f) => f.id === ouverte) ?? null : null;
  return (
    <div>
      <ErreurChargement message={erreur} />
      <BarreOutils
        droite={
          l.droits.gerer && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setEdition('nouvelle')}>
              <Plus aria-hidden size={16} /> Nouvelle fiche de poste
            </button>
          )
        }
      >
        <Recherche value={recherche} onChange={setRecherche} placeholder="Fonction, mission…" label="Rechercher une fiche de poste" />
        <span className="text-[12.5px] text-text-muted">Chaque fiche décrit une fonction : tout titulaire de la fonction et sa hiérarchie la consultent.</span>
      </BarreOutils>
      <Tableau
        label="Fiches de poste"
        testid="fiches-poste"
        grille={GRILLE}
        colonnes={['Fonction', 'Contenu', 'Mise à jour', <span key="a" className="sr-only">Actions</span>]}
        vide={
          <EtatVide
            texte={q ? 'Aucune fiche ne correspond à la recherche.' : 'Aucune fiche de poste rédigée.'}
            action={l.droits.gerer && !q ? <button type="button" className={BTN_LIGNE} onClick={() => setEdition('nouvelle')}>Rédiger la première fiche</button> : undefined}
          />
        }
      >
        {fiches.map((f) => (
          <LigneTableau key={f.id} grille={GRILLE} testid="fiche-poste" label={f.fonction} onClick={() => setOuverte(f.id)} actif={ouverte === f.id}>
            <span className="flex flex-wrap items-center gap-2">
              <b className="font-semibold text-ink-900">{f.fonction}</b>
              {l.maFicheId === f.id && <Pastille ton="vert">Ma fonction</Pastille>}
            </span>
            <span className="text-[12.5px] text-text-muted">{[f.missions && 'Missions', f.activites && 'Activités', f.competences && 'Compétences'].filter(Boolean).join(' · ')}</span>
            <span className="text-text-muted">{new Date(f.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="flex lg:justify-end">
              <button type="button" className={BTN_LIGNE} aria-label={`Voir la fiche : ${f.fonction}`} onClick={(e) => (e.stopPropagation(), setOuverte(f.id))}>
                Voir
              </button>
            </span>
          </LigneTableau>
        ))}
      </Tableau>
      {detail && (
        <FenetreDetail
          titre={detail.fonction}
          filAriane={['Ressources humaines', 'Fiches de poste']}
          onClose={() => setOuverte(null)}
          largeur={880}
          testid="fiche-poste-detail"
          cote={
            <div>
              {l.droits.gerer ? (
                <button type="button" className={`${BTN_SECONDAIRE} w-full`} onClick={() => setEdition(detail)}>
                  <Pencil aria-hidden size={15} /> Modifier
                </button>
              ) : (
                <p className="text-[12.5px] text-text-muted">Fiche consultable par tout titulaire de la fonction et sa hiérarchie.</p>
              )}
              <div className="mt-4 border-t border-line pt-4">
                <CleValeur
                  largeur={96}
                  lignes={[
                    ['Fonction', detail.fonction],
                    ['Mise à jour', new Date(detail.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })],
                    ...(l.maFicheId === detail.id ? ([['Vous', <Pastille key="m" ton="vert">Ma fonction</Pastille>]] as [string, ReactNode][]) : []),
                  ]}
                />
              </div>
            </div>
          }
        >
          <SectionFenetre titre="Missions">
            <p className="whitespace-pre-line text-[13.5px]">{detail.missions}</p>
          </SectionFenetre>
          {detail.activites && (
            <SectionFenetre titre="Activités">
              <p className="whitespace-pre-line text-[13.5px]">{detail.activites}</p>
            </SectionFenetre>
          )}
          {detail.competences && (
            <SectionFenetre titre="Compétences">
              <p className="whitespace-pre-line text-[13.5px]">{detail.competences}</p>
            </SectionFenetre>
          )}
        </FenetreDetail>
      )}
      {edition && <FenetreFiche fiche={edition === 'nouvelle' ? null : edition} onClose={() => setEdition(null)} onFait={() => (setEdition(null), charger())} />}
    </div>
  );
}

function FenetreFiche({ fiche, onClose, onFait }: { fiche: FichePoste | null; onClose: () => void; onFait: () => void }) {
  const [v, setV] = useState({ fonction: fiche?.fonction ?? '', missions: fiche?.missions ?? '', activites: fiche?.activites ?? '', competences: fiche?.competences ?? '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Fenetre
      titre={fiche ? 'Modifier la fiche de poste' : 'Nouvelle fiche de poste'}
      onClose={onClose}
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onSubmit={async () => {
        setEnCours(true);
        setErreur(null);
        try {
          await enregistrerFichePoste({ fonction: v.fonction, missions: v.missions, activites: v.activites || undefined, competences: v.competences || undefined }, fiche?.id);
          onFait();
        } catch (x) {
          setErreur(messageChargement(x));
        } finally {
          setEnCours(false);
        }
      }}
    >
      <label className="mb-3 block text-[12.5px] font-semibold">Fonction<input required value={v.fonction} onChange={set('fonction')} className={champ} /></label>
      <label className="mb-3 block text-[12.5px] font-semibold">Missions<textarea required rows={4} value={v.missions} onChange={set('missions')} className={champ} /></label>
      <label className="mb-3 block text-[12.5px] font-semibold">Activités<textarea rows={3} value={v.activites} onChange={set('activites')} className={champ} /></label>
      <label className="block text-[12.5px] font-semibold">Compétences<textarea rows={3} value={v.competences} onChange={set('competences')} className={champ} /></label>
    </Fenetre>
  );
}
