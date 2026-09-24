'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { exporterActes, exporterArrivees, getActes, getArrivees, getMesHabilitations, getRegistres, getTableauDeBord, getUnites } from '../../../lib/api/courrier';
import {
  ACTE_STATUT_LABEL,
  ARRIVEE_STATUT_LABEL,
  type Acte,
  type ActeStatut,
  type Arrivee,
  type ArriveeStatut,
  type Registre,
  type TableauDeBordCourrier,
  type Unite,
} from '../../../lib/courrier/types';
import { AFaire } from '../../../components/courrier/AFaire';
import { CompteursCourrier, RUBRIQUES, type Rubrique } from '../../../components/courrier/CompteursCourrier';
import { Filtres, type FiltresValeur } from '../../../components/courrier/Filtres';
import { LigneActe, LigneArrivee, Vide } from '../../../components/courrier/Lignes';
import { Erreur, messageErreur } from '../../../components/courrier/ui';
import { TiroirArrivee } from '../../../components/courrier/TiroirArrivee';
import { FenetreEnregistrer } from '../../../components/courrier/FenetresArrivee';
import { TiroirActe } from '../../../components/courrier/TiroirActe';
import { FenetreRediger } from '../../../components/courrier/FenetresActe';
import { Button } from '../../../components/ui/Button';

type Onglet = 'a-faire' | 'arrivees' | 'actes';
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'a-faire', libelle: 'À faire' },
  { cle: 'arrivees', libelle: 'Arrivées' },
  { cle: 'actes', libelle: 'Départs et actes' },
];

export default function CourrierPage() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>('a-faire');
  const [rubrique, setRubrique] = useState<Rubrique | null>(null);
  const [arriveeId, setArriveeId] = useState<string | null>(null);
  const [acteId, setActeId] = useState<string | null>(null);

  const [tableau, setTableau] = useState<TableauDeBordCourrier | null>(null);
  const [aFaire, setAFaire] = useState<{ arrivees: Arrivee[]; actes: Acte[] } | null>(null);
  const [registres, setRegistres] = useState<Registre[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [habilitations, setHabilitations] = useState<Awaited<ReturnType<typeof getMesHabilitations>>>([]);
  const [filtresArr, setFiltresArr] = useState<FiltresValeur>({});
  const [filtresActes, setFiltresActes] = useState<FiltresValeur>({});
  const [arrivees, setArrivees] = useState<Arrivee[] | null>(null);
  const [actes, setActes] = useState<Acte[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrer, setEnregistrer] = useState(false);
  /** Fenêtre de rédaction : null = fermée ; repondA = réponse à un courrier arrivée. */
  const [rediger, setRediger] = useState<{ repondA?: { id: string; numero: string } } | null>(null);

  // Ouverture profonde (liens des emails : ?arrivee=, ?acte= ; carte du tableau
  // de bord : ?rubrique=) — lue une fois au montage, comme /communication.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('rubrique');
    if (r && RUBRIQUES.some((x) => x.cle === r)) setRubrique(r as Rubrique);
    const o = p.get('onglet');
    if (o === 'arrivees' || o === 'actes') setOnglet(o);
    setArriveeId(p.get('arrivee'));
    setActeId(p.get('acte'));
  }, []);

  const majUrl = useCallback(
    (s: { onglet?: Onglet; rubrique?: Rubrique | null; arrivee?: string | null; acte?: string | null }) => {
      const p = new URLSearchParams();
      if (s.onglet && s.onglet !== 'a-faire') p.set('onglet', s.onglet);
      if (s.rubrique) p.set('rubrique', s.rubrique);
      if (s.arrivee) p.set('arrivee', s.arrivee);
      if (s.acte) p.set('acte', s.acte);
      const qs = p.toString();
      router.replace(qs ? `/courrier?${qs}` : '/courrier', { scroll: false });
    },
    [router],
  );
  const etat = { onglet, rubrique, arrivee: arriveeId, acte: acteId };

  const chargerAFaire = useCallback(() => {
    Promise.all([getTableauDeBord(), getArrivees(), getActes()])
      .then(([t, arr, act]) => {
        setTableau(t);
        setAFaire({ arrivees: arr, actes: act });
      })
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger le courrier')));
  }, []);

  useEffect(() => {
    chargerAFaire();
    Promise.all([getRegistres(), getUnites(), getMesHabilitations()])
      .then(([r, u, h]) => {
        setRegistres(r);
        setUnites(u);
        setHabilitations(h);
      })
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les registres')));
  }, [chargerAFaire]);

  // Numéro de la dernière requête de chaque liste : une réponse arrivée après
  // un changement de filtre est ignorée (elle afficherait l'ancien filtre).
  const requeteArr = useRef(0);
  const requeteActes = useRef(0);
  const chargerArrivees = useCallback(() => {
    const n = ++requeteArr.current;
    setArrivees(null);
    getArrivees({ ...filtresArr, statut: filtresArr.statut as ArriveeStatut | undefined })
      .then((r) => n === requeteArr.current && setArrivees(r))
      .catch((e) => n === requeteArr.current && setErreur(messageErreur(e, 'Impossible de charger le registre des arrivées')));
  }, [filtresArr]);
  const chargerActes = useCallback(() => {
    const n = ++requeteActes.current;
    setActes(null);
    getActes({ ...filtresActes, statut: filtresActes.statut as ActeStatut | undefined })
      .then((r) => n === requeteActes.current && setActes(r))
      .catch((e) => n === requeteActes.current && setErreur(messageErreur(e, 'Impossible de charger les départs et actes')));
  }, [filtresActes]);

  useEffect(() => {
    if (onglet === 'arrivees') chargerArrivees();
  }, [onglet, chargerArrivees]);
  useEffect(() => {
    if (onglet === 'actes') chargerActes();
  }, [onglet, chargerActes]);

  /** Après une action dans un tiroir : tout ce qui peut en dépendre est rechargé. */
  const recharger = useCallback(() => {
    chargerAFaire();
    if (onglet === 'arrivees') chargerArrivees();
    if (onglet === 'actes') chargerActes();
  }, [chargerAFaire, chargerArrivees, chargerActes, onglet]);

  const libelleUnite = useMemo(() => {
    const m = new Map(unites.map((u) => [u.key, u.code]));
    return (key: string) => m.get(key) ?? key;
  }, [unites]);

  const ouvrirArrivee = (id: string) => {
    setActeId(null);
    setArriveeId(id);
    majUrl({ ...etat, arrivee: id, acte: null });
  };
  const ouvrirActe = (id: string) => {
    setArriveeId(null);
    setActeId(id);
    majUrl({ ...etat, acte: id, arrivee: null });
  };
  const fermer = () => {
    setArriveeId(null);
    setActeId(null);
    majUrl({ ...etat, arrivee: null, acte: null });
  };
  const choisirOnglet = (o: Onglet) => {
    setOnglet(o);
    majUrl({ ...etat, onglet: o, rubrique: o === 'a-faire' ? rubrique : null });
  };
  const choisirRubrique = (r: Rubrique) => {
    const suivante = rubrique === r ? null : r;
    setRubrique(suivante);
    setOnglet('a-faire');
    majUrl({ ...etat, onglet: 'a-faire', rubrique: suivante });
  };

  async function exporter() {
    setErreur(null);
    try {
      if (onglet === 'arrivees') await exporterArrivees({ ...filtresArr, statut: filtresArr.statut as ArriveeStatut | undefined });
      else await exporterActes({ ...filtresActes, statut: filtresActes.statut as ActeStatut | undefined });
    } catch (e) {
      setErreur(messageErreur(e, 'Export impossible'));
    }
  }

  const registresArrivee = registres.filter((r) => r.nature === 'ARRIVEE');
  const registresActes = registres.filter((r) => r.nature !== 'ARRIVEE');
  const peutEnregistrer = habilitations.some((h) => h.registre.nature === 'ARRIVEE');

  return (
    <div>
      <div className="mb-5">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">Général</div>
        <h1 className="text-[22px] font-extrabold">Courrier et actes</h1>
        <p className="mt-1 max-w-[680px] text-[13px] text-text-muted">
          Registres du courrier arrivée, des départs et des actes : enregistrement, imputation, visa, signature et expédition.
        </p>
      </div>

      {tableau && (
        <div className="mb-5">
          <CompteursCourrier tableau={tableau} actif={onglet === 'a-faire' ? rubrique : null} onChoisir={choisirRubrique} />
        </div>
      )}

      <div role="tablist" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            role="tab"
            aria-selected={onglet === o.cle}
            onClick={() => choisirOnglet(o.cle)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold ${
              onglet === o.cle ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-text-muted hover:text-ink'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      <Erreur message={erreur} />

      {onglet === 'a-faire' &&
        (aFaire ? (
          <AFaire
            arrivees={aFaire.arrivees}
            actes={aFaire.actes}
            rubrique={rubrique}
            unite={libelleUnite}
            ouvrirArrivee={ouvrirArrivee}
            ouvrirActe={ouvrirActe}
          />
        ) : (
          <p className="text-sm text-text-muted">Chargement…</p>
        ))}

      {onglet === 'arrivees' && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Button onClick={exporter}>Exporter (Excel)</Button>
            {peutEnregistrer && (
              <Button variant="gold" onClick={() => setEnregistrer(true)}>
                + Enregistrer un courrier
              </Button>
            )}
          </div>
          <Filtres valeur={filtresArr} onChange={setFiltresArr} registres={registresArrivee} statuts={ARRIVEE_STATUT_LABEL} />
          {arrivees === null ? (
            <p className="text-sm text-text-muted">Chargement…</p>
          ) : arrivees.length === 0 ? (
            <Vide>Aucun courrier arrivée pour ces critères.</Vide>
          ) : (
            <div className="space-y-2">
              {arrivees.map((a) => (
                <LigneArrivee key={a.id} a={a} unite={libelleUnite} onOpen={() => ouvrirArrivee(a.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {onglet === 'actes' && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Button onClick={exporter}>Exporter (Excel)</Button>
            <Button variant="gold" onClick={() => setRediger({})}>
              + Rédiger
            </Button>
          </div>
          <Filtres valeur={filtresActes} onChange={setFiltresActes} registres={registresActes} statuts={ACTE_STATUT_LABEL} />
          {actes === null ? (
            <p className="text-sm text-text-muted">Chargement…</p>
          ) : actes.length === 0 ? (
            <Vide>Aucun départ ni acte pour ces critères.</Vide>
          ) : (
            <div className="space-y-2">
              {actes.map((a) => (
                <LigneActe key={a.id} a={a} onOpen={() => ouvrirActe(a.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {arriveeId && (
        <TiroirArrivee
          key={arriveeId}
          id={arriveeId}
          unites={unites}
          onClose={fermer}
          onChange={recharger}
          onOuvrirActe={ouvrirActe}
          onRepondre={(a) => setRediger({ repondA: { id: a.id, numero: a.numero } })}
        />
      )}
      {acteId && <TiroirActe key={acteId} id={acteId} registres={registres} onClose={fermer} onChange={recharger} onOuvrirArrivee={ouvrirArrivee} />}
      {rediger && (
        <FenetreRediger
          registres={registres}
          repondA={rediger.repondA}
          onClose={() => setRediger(null)}
          onEnregistre={(acte) => {
            setRediger(null);
            recharger();
            ouvrirActe(acte.id);
          }}
        />
      )}
      {enregistrer && (
        <FenetreEnregistrer
          unites={unites}
          onClose={() => setEnregistrer(false)}
          onEnregistre={(a) => {
            setEnregistrer(false);
            recharger();
            ouvrirArrivee(a.id);
          }}
        />
      )}
    </div>
  );
}
