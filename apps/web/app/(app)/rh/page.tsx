'use client';

import { useEffect, useState } from 'react';
import { exporterEffectifs, getAlertesRh, getOngletsRh } from '../../../lib/api/rh';
import type { AlerteRh, TypeAlerteRh } from '../../../lib/rh/types';
import { FileSpreadsheet } from 'lucide-react';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { OngletEffectifs } from '../../../components/rh/OngletEffectifs';
import { OngletAlertes } from '../../../components/rh/OngletAlertes';
import { OngletCarriere } from '../../../components/rh/OngletCarriere';
import { OngletFiches } from '../../../components/rh/OngletFiches';
import { OngletFormation } from '../../../components/rh/OngletFormation';
import { OngletPieces } from '../../../components/rh/OngletPieces';
import { BTN_SECONDAIRE, EnTetePage, Onglets } from '../../../components/ui/Charte';
import { SquelettePage } from '../../../components/ui/Squelette';
import { messageErreur, useToast } from '../../../components/ui/Toast';

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
  // Alertes (DRH seul, selon l'onglet renvoyé par l'API) : compteur de l'onglet et panneau des effectifs.
  const [alertes, setAlertes] = useState<AlerteRh[] | null>(null);
  const [typeAlerte, setTypeAlerte] = useState<TypeAlerteRh | ''>('');
  const toast = useToast();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const demande = p.get('onglet') as Cle | null;
    setUserId(p.get('userId') ?? undefined);
    getOngletsRh()
      .then((o) => {
        setOnglets(o);
        if (o.alertes) getAlertesRh().then(setAlertes).catch((e) => setErreur(messageChargement(e)));
        const ouverts = (Object.keys(LIBELLES) as Cle[]).filter((c) => o[c]);
        setOnglet(demande && o[demande] ? demande : ouverts[0] ?? 'carriere');
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, []);

  if (!onglets) {
    return (
      <div>
        <ErreurChargement message={erreur} />
        {erreur ? <EnTetePage titre="Ressources humaines" /> : <SquelettePage />}
      </div>
    );
  }
  const visibles = (Object.keys(LIBELLES) as Cle[]).filter((c) => onglets[c]);
  const ouvrir = (c: Cle) => {
    setOnglet(c);
    window.history.replaceState(null, '', `/rh?onglet=${c}`);
  };
  return (
    <div>
      <EnTetePage
        titre="Ressources humaines"
        actions={
          onglet === 'effectifs' && (
            <button type="button" className={BTN_SECONDAIRE} onClick={() => void exporterEffectifs().then(() => toast.succes('Effectifs exportés', { detail: 'Le fichier Excel est téléchargé.' })).catch((e) => toast.erreur('Export impossible', messageErreur(e)))}>
              <FileSpreadsheet aria-hidden size={16} />
              Exporter
            </button>
          )
        }
      />
      <ErreurChargement message={erreur} />
      <Onglets
        label="Rubriques des ressources humaines"
        actif={onglet}
        onChange={(c) => {
          setTypeAlerte('');
          ouvrir(c);
        }}
        onglets={visibles.map((c) => ({ cle: c, label: LIBELLES[c], ...(c === 'alertes' ? { n: alertes?.length ?? null, chaud: true } : {}) }))}
      />
      {onglet === 'effectifs' && (
        <OngletEffectifs
          alertes={onglets.alertes ? alertes ?? [] : null}
          onVoirAlertes={(t) => {
            setTypeAlerte(t);
            ouvrir('alertes');
          }}
        />
      )}
      {onglet === 'alertes' && <OngletAlertes typeInitial={typeAlerte} />}
      {onglet === 'carriere' && <OngletCarriere userId={userId} voirFamilles={onglets.familles} />}
      {onglet === 'fiches' && <OngletFiches />}
      {onglet === 'formation' && <OngletFormation />}
      {onglet === 'pieces' && <OngletPieces />}
    </div>
  );
}
