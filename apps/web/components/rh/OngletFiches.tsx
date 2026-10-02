'use client';

import { useCallback, useEffect, useState } from 'react';
import { enregistrerFichePoste, getFichesPoste } from '../../lib/api/rh';
import type { FichePoste, Fiches } from '../../lib/rh/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Fenetre } from '../ui/Fenetre';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

const champ = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]';

/** Fiches de poste (SIG-RF-CAR-07) : rattachées à la fonction, jamais à la personne. */
export function OngletFiches() {
  const [l, setL] = useState<Fiches | null>(null);
  const [edition, setEdition] = useState<FichePoste | 'nouvelle' | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => getFichesPoste().then((f) => (setL(f), setOuverte((o) => o ?? f.maFicheId))).catch((x) => setErreur(messageChargement(x))), []);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  return (
    <div className="max-w-[860px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-text-muted">Chaque fiche décrit une fonction : tout titulaire de la fonction et sa hiérarchie la consultent.</p>
        {l.droits.gerer && <Button variant="solid" onClick={() => setEdition('nouvelle')}>+ Nouvelle fiche de poste</Button>}
      </div>
      {l.fiches.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-5 text-[13px] text-text-muted">Aucune fiche de poste rédigée.</p>
      ) : (
        <ul className="space-y-2" data-testid="fiches-poste">
          {l.fiches.map((f) => (
            <li key={f.id} className="rounded-lg border border-line bg-surface">
              <button aria-expanded={ouverte === f.id} onClick={() => setOuverte(ouverte === f.id ? null : f.id)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
                <span className="text-[13.5px] font-semibold">{f.fonction}</span>
                {l.maFicheId === f.id && <Badge tone="sage">Ma fonction</Badge>}
              </button>
              {ouverte === f.id && (
                <div className="border-t border-line px-4 py-3 text-[13px]">
                  <h3 className="font-bold">Missions</h3>
                  <p className="mb-2 whitespace-pre-line">{f.missions}</p>
                  {f.activites && (<><h3 className="font-bold">Activités</h3><p className="mb-2 whitespace-pre-line">{f.activites}</p></>)}
                  {f.competences && (<><h3 className="font-bold">Compétences</h3><p className="mb-2 whitespace-pre-line">{f.competences}</p></>)}
                  {l.droits.gerer && <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => setEdition(f)}>Modifier</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
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
