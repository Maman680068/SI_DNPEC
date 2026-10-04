'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, PenLine, Plus } from 'lucide-react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { exporterActes, exporterArrivees, getActes, getArrivees, getMesHabilitations, getRegistres, getTableauDeBord, getUnites } from '../../../lib/api/courrier';
import {
  ACTE_STATUT_LABEL,
  ARRIVEE_STATUT_LABEL,
  nomPersonne,
  type Acte,
  type ActeStatut,
  type Arrivee,
  type ArriveeStatut,
  type Registre,
  type TableauDeBordCourrier,
  type Unite,
} from '../../../lib/courrier/types';
import { anneeActe, imputationsRacines, listeAnnees } from '../../../lib/courrier/affichage';
import { AFaire } from '../../../components/courrier/AFaire';
import { CompteursCourrier, RUBRIQUES, totalAFaire, type Rubrique } from '../../../components/courrier/CompteursCourrier';
import { Filtres, type FiltresValeur } from '../../../components/courrier/Filtres';
import { COLONNES_ACTES, COLONNES_ARRIVEES, GRILLE_ACTES, GRILLE_ARRIVEES, LigneActe, LigneArrivee } from '../../../components/courrier/Lignes';
import { Erreur, messageErreur } from '../../../components/courrier/ui';
import { TiroirArrivee } from '../../../components/courrier/TiroirArrivee';
import { FenetreEnregistrer } from '../../../components/courrier/FenetresArrivee';
import { TiroirActe } from '../../../components/courrier/TiroirActe';
import { FenetreRediger } from '../../../components/courrier/FenetresActe';
import { BTN_PRINCIPAL, BTN_SECONDAIRE, BandeCompteurs, EnTetePage, EtatVide, Onglets, Tableau, type Compteur } from '../../../components/ui/Charte';

type Onglet = 'a-faire' | 'arrivees' | 'actes';
/** Filtre de statut posé par un compteur de la bande (vue du registre). */
type Carte = 'arriveesEnAttente' | 'visasEnCours' | 'actesASigner' | 'actesAExpedier';
const CARTES: { cle: Carte; label: string; sous: string; onglet: 'arrivees' | 'actes'; statut: string; ton: Compteur['ton']; perso: Rubrique }[] = [
  { cle: 'arriveesEnAttente', label: 'À imputer', sous: 'arrivées en attente', onglet: 'arrivees', statut: 'ENREGISTRE', ton: 'ambre', perso: 'aImputer' },
  { cle: 'visasEnCours', label: 'Visas en cours', sous: 'actes dans le circuit', onglet: 'actes', statut: 'EN_VISA', ton: 'encre', perso: 'aViser' },
  { cle: 'actesASigner', label: 'À signer', sous: 'en attente de signature', onglet: 'actes', statut: 'A_SIGNER', ton: 'rouge', perso: 'aSigner' },
  { cle: 'actesAExpedier', label: 'À expédier', sous: 'signés, non partis', onglet: 'actes', statut: 'SIGNE', ton: 'vert', perso: 'aExpedier' },
];

const SANS_TROU = 'Numérotation continue, sans trou';

export default function CourrierPage() {
  const router = useRouter();
  const { user } = useAuth();
  /** Administrateur système : son seul courrier personnel (l'API ne lui renvoie rien d'autre). */
  const personnel = user?.role === 'ADMIN_SYSTEME';
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
  const [imputeA, setImputeA] = useState('');
  const [arrivees, setArrivees] = useState<Arrivee[] | null>(null);
  const [actes, setActes] = useState<Acte[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrer, setEnregistrer] = useState(false);
  /** Fenêtre de rédaction : null = fermée ; repondA = réponse à un courrier arrivée. */
  const [rediger, setRediger] = useState<{ repondA?: { id: string; numero: string } } | null>(null);

  // Ouverture profonde (liens des emails : ?arrivee=, ?acte= ; tableau de bord : ?rubrique=,
  // ?onglet=) — lue une fois au montage, comme /communication.
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

  /** Après une action dans une fenêtre : tout ce qui peut en dépendre est rechargé. */
  const recharger = useCallback(() => {
    chargerAFaire();
    if (onglet === 'arrivees') chargerArrivees();
    if (onglet === 'actes') chargerActes();
  }, [chargerAFaire, chargerArrivees, chargerActes, onglet]);

  const libelleUnite = useMemo(() => {
    const m = new Map(unites.map((u) => [u.key, u.code]));
    // Unité inconnue : supprimée depuis (le courrier ne garde que sa clé) — jamais la clé brute à l'écran.
    return (key: string) => m.get(key) ?? 'unité supprimée';
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
  /** Compteur de la bande : le registre concerné, filtré sur ce statut (second clic : filtre retiré). */
  const carteActive = (c: (typeof CARTES)[number]) => onglet === c.onglet && (c.onglet === 'arrivees' ? filtresArr : filtresActes).statut === c.statut;
  const choisirCarte = (c: (typeof CARTES)[number]) => {
    const statut = carteActive(c) ? undefined : c.statut;
    if (c.onglet === 'arrivees') setFiltresArr((f) => ({ ...f, statut }));
    else setFiltresActes((f) => ({ ...f, statut }));
    setOnglet(c.onglet);
    majUrl({ ...etat, onglet: c.onglet, rubrique: null });
  };

  async function exporter() {
    setErreur(null);
    try {
      if (onglet === 'actes') await exporterActes({ ...filtresActes, statut: filtresActes.statut as ActeStatut | undefined });
      else await exporterArrivees({ ...filtresArr, statut: filtresArr.statut as ArriveeStatut | undefined });
    } catch (e) {
      setErreur(messageErreur(e, 'Export impossible'));
    }
  }

  const registresArrivee = registres.filter((r) => r.nature === 'ARRIVEE');
  const registresActes = registres.filter((r) => r.nature !== 'ARRIVEE');
  const peutEnregistrer = habilitations.some((h) => h.registre.nature === 'ARRIVEE');

  // « Imputé à » : personnes imputées (premier niveau) dans la liste chargée ; filtre local.
  const imputes = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of arrivees ?? []) for (const i of imputationsRacines(a)) m.set(i.imputeAId, nomPersonne(a.personnes, i.imputeAId));
    return [...m].map(([id, nom]) => ({ id, nom })).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
  }, [arrivees]);
  const arriveesAffichees = useMemo(
    () => (arrivees && imputeA ? arrivees.filter((a) => imputationsRacines(a).some((i) => i.imputeAId === imputeA)) : arrivees),
    [arrivees, imputeA],
  );

  const libelleRegistre = (id: string | undefined, liste: Registre[]) => (id ? `registre « ${liste.find((r) => r.id === id)?.libelle ?? '…'} »` : 'tous les registres');
  const piedArrivees = arriveesAffichees && (
    <>
      <span>
        {arriveesAffichees.length} courrier{arriveesAffichees.length > 1 ? 's' : ''} affiché{arriveesAffichees.length > 1 ? 's' : ''} · {libelleRegistre(filtresArr.registreId, registresArrivee)}
        {arriveesAffichees.length > 0 ? `, ${listeAnnees(arriveesAffichees.map((a) => a.annee))}` : ''}
      </span>
      <span>{SANS_TROU}</span>
    </>
  );
  const piedActes = actes && (
    <>
      <span>
        {actes.length} départ{actes.length > 1 ? 's' : ''} et acte{actes.length > 1 ? 's' : ''} affiché{actes.length > 1 ? 's' : ''} · {libelleRegistre(filtresActes.registreId, registresActes)}
        {actes.length > 0 ? `, ${listeAnnees(actes.map(anneeActe))}` : ''}
      </span>
      <span>{SANS_TROU}</span>
    </>
  );

  const onglets = [
    { cle: 'a-faire' as const, label: 'À faire', n: tableau ? totalAFaire(tableau) : null, chaud: true },
    { cle: 'arrivees' as const, label: personnel ? 'Mes plis personnels' : 'Arrivées', n: aFaire?.arrivees.length ?? null },
    { cle: 'actes' as const, label: personnel ? 'Mes actes' : 'Départs et actes', n: aFaire?.actes.length ?? null },
  ];

  return (
    <div>
      <EnTetePage
        titre={personnel ? 'Mon courrier' : 'Courrier et actes'}
        sousTitre={personnel ? 'Plis qui vous sont adressés, lettres et actes que vous rédigez ou qui vous concernent' : undefined}
        actions={
          <>
            <button type="button" className={BTN_SECONDAIRE} onClick={exporter}>
              <FileText aria-hidden size={16} />
              Exporter
            </button>
            {peutEnregistrer && (
              <button type="button" className={BTN_PRINCIPAL} onClick={() => setEnregistrer(true)}>
                <Plus aria-hidden size={16} />
                Enregistrer un courrier
              </button>
            )}
          </>
        }
      />

      {tableau && !personnel && (
        <BandeCompteurs
          variante="cartes"
          label="Registre du courrier"
          items={CARTES.map((c) => ({
            valeur: tableau[c.cle],
            label: c.label,
            sous: tableau[c.perso] > 0 ? `${c.sous} · dont ${tableau[c.perso]} pour vous` : c.sous,
            ton: tableau[c.cle] > 0 ? c.ton : 'gris',
            onClick: () => choisirCarte(c),
            actif: carteActive(c),
            testid: `carte-${c.cle}`,
          }))}
        />
      )}

      <Onglets label="Courrier" onglets={onglets} actif={onglet} onChange={choisirOnglet} />

      <Erreur message={erreur} />

      {onglet === 'a-faire' && (
        <>
          {tableau && <CompteursCourrier tableau={tableau} actif={rubrique} onChoisir={choisirRubrique} />}
          {aFaire ? (
            <AFaire arrivees={aFaire.arrivees} actes={aFaire.actes} rubrique={rubrique} unite={libelleUnite} ouvrirArrivee={ouvrirArrivee} ouvrirActe={ouvrirActe} />
          ) : (
            <p className="text-sm text-text-muted">Chargement…</p>
          )}
        </>
      )}

      {onglet === 'arrivees' && (
        <>
          <Filtres
            key="arrivees"
            valeur={filtresArr}
            onChange={setFiltresArr}
            registres={registresArrivee}
            statuts={ARRIVEE_STATUT_LABEL}
            imputes={imputes}
            imputeA={imputeA}
            onImputeA={setImputeA}
            placeholder="Numéro, objet, expéditeur…"
          />
          {arriveesAffichees === null ? (
            <p className="text-sm text-text-muted">Chargement…</p>
          ) : (
            <Tableau
              label={personnel ? 'Mes plis personnels' : 'Registre des arrivées'}
              colonnes={COLONNES_ARRIVEES}
              grille={GRILLE_ARRIVEES}
              testid="registre-arrivees"
              pied={piedArrivees}
              vide={
                <EtatVide
                  texte="Aucun courrier arrivée pour ces critères."
                  action={
                    peutEnregistrer ? (
                      <button type="button" className={BTN_SECONDAIRE} onClick={() => setEnregistrer(true)}>
                        <Plus aria-hidden size={16} />
                        Enregistrer un courrier
                      </button>
                    ) : undefined
                  }
                />
              }
            >
              {arriveesAffichees.map((a) => (
                <LigneArrivee key={a.id} a={a} unite={libelleUnite} onOpen={() => ouvrirArrivee(a.id)} />
              ))}
            </Tableau>
          )}
        </>
      )}

      {onglet === 'actes' && (
        <>
          <Filtres
            key="actes"
            valeur={filtresActes}
            onChange={setFiltresActes}
            registres={registresActes}
            statuts={ACTE_STATUT_LABEL}
            placeholder="Numéro, objet, destinataire…"
            droite={
              <button type="button" className={BTN_SECONDAIRE} onClick={() => setRediger({})}>
                <PenLine aria-hidden size={16} />
                Rédiger
              </button>
            }
          />
          {actes === null ? (
            <p className="text-sm text-text-muted">Chargement…</p>
          ) : (
            <Tableau
              label={personnel ? 'Mes actes' : 'Registre des départs et actes'}
              colonnes={COLONNES_ACTES}
              grille={GRILLE_ACTES}
              testid="registre-actes"
              pied={piedActes}
              vide={
                <EtatVide
                  texte="Aucun départ ni acte pour ces critères."
                  action={
                    <button type="button" className={BTN_SECONDAIRE} onClick={() => setRediger({})}>
                      <PenLine aria-hidden size={16} />
                      Rédiger un départ ou un acte
                    </button>
                  }
                />
              }
            >
              {actes.map((a) => (
                <LigneActe key={a.id} a={a} onOpen={() => ouvrirActe(a.id)} />
              ))}
            </Tableau>
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
