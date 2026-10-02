'use client';

import { useEffect, useState } from 'react';
import { getOngletsRh } from '../../../lib/api/rh';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { OngletEffectifs } from '../../../components/rh/OngletEffectifs';
import { OngletAlertes } from '../../../components/rh/OngletAlertes';
import { OngletCarriere } from '../../../components/rh/OngletCarriere';
import { OngletFiches } from '../../../components/rh/OngletFiches';
import { OngletFormation } from '../../../components/rh/OngletFormation';
import { OngletPieces } from '../../../components/rh/OngletPieces';

type Cle = 'effectifs' | 'alertes' | 'carriere' | 'fiches' | 'formation' | 'pieces';
const LIBELLES: Record<Cle, string> = {
  effectifs: 'Effectifs',
  alertes: 'Alertes',
  carriere: 'Carrière et actes',
  fiches: 'Fiches de poste',
  formation: 'Formation',
  pieces: 'Pièces requises',
};

/** Ressources humaines (socle N6) : effectifs, alertes, carrière et actes, fiches de poste, formation. */
export default function RhPage() {
  const [onglets, setOnglets] = useState<Record<Cle | 'familles', boolean> | null>(null);
  const [onglet, setOnglet] = useState<Cle>('carriere');
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const demande = p.get('onglet') as Cle | null;
    setUserId(p.get('userId') ?? undefined);
    getOngletsRh()
      .then((o) => {
        setOnglets(o);
        const ouverts = (Object.keys(LIBELLES) as Cle[]).filter((c) => o[c]);
        setOnglet(demande && o[demande] ? demande : ouverts[0] ?? 'carriere');
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);

  if (!onglets) {
    return (
      <div>
        <ErreurChargement message={erreur} />
        <Chargement erreur={erreur} />
      </div>
    );
  }
  const visibles = (Object.keys(LIBELLES) as Cle[]).filter((c) => onglets[c]);
  return (
    <div className="max-w-[1080px]">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Personnel</div>
      <h1 className="mb-1 text-[22px] font-extrabold">Ressources humaines</h1>
      <p className="mb-5 text-[13px] text-text-muted">
        Effectifs et alertes calculés à partir des dossiers, jamais saisis ; mouvements de carrière portés par un acte numéroté du
        Courrier et appliqués au dossier à sa signature.
      </p>
      <ErreurChargement message={erreur} />
      <div role="tablist" aria-label="Rubriques des ressources humaines" className="mb-4 flex w-fit max-w-full flex-wrap gap-0.5 rounded-md border border-line bg-bg p-0.5">
        {visibles.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={onglet === c}
            onClick={() => {
              setOnglet(c);
              window.history.replaceState(null, '', `/rh?onglet=${c}`);
            }}
            className={`rounded-[6px] px-4 py-1.5 text-[12.5px] font-semibold ${onglet === c ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
          >
            {LIBELLES[c]}
          </button>
        ))}
      </div>
      {onglet === 'effectifs' && <OngletEffectifs />}
      {onglet === 'alertes' && <OngletAlertes />}
      {onglet === 'carriere' && <OngletCarriere userId={userId} voirFamilles={onglets.familles} />}
      {onglet === 'fiches' && <OngletFiches />}
      {onglet === 'formation' && <OngletFormation />}
      {onglet === 'pieces' && <OngletPieces />}
    </div>
  );
}
