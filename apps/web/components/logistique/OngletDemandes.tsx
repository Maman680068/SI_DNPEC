'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import {
  annulerDemande,
  creerDemande,
  getArticles,
  getBiens,
  getCategories,
  getDemande,
  getDemandes,
  prendreEnCharge,
  refuserDemande,
  traiterDemande,
  validerDemande,
} from '../../lib/api/logistique';
import type { Article, Bien, Categorie, Demande, StatutDemande, TypeDemande } from '../../lib/logistique/types';
import { TYPE_DEMANDE_LABEL } from '../../lib/logistique/types';
import { Erreur, Fenetre, SELECT_CLASS, TEXTAREA_CLASS } from '../courrier/ui';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import {
  BTN_DANGER_CONTOUR,
  BTN_LIGNE,
  BTN_LIGNE_PRINCIPAL,
  BTN_PRINCIPAL,
  BTN_SECONDAIRE,
  BarreOutils,
  CleValeur,
  EtatVide,
  Etapes,
  FiltreSelect,
  LigneTableau,
  Pastille,
  Recherche,
  SectionFenetre,
  Tableau,
  type TonPastille,
} from '../ui/Charte';
import { Champ, Info, Panneau, SousOnglets, dateCourte, dateHeure, nom, useAction } from './commun';

export type VueDemandes = 'miennes' | 'a_valider' | 'a_traiter';
type Vue = VueDemandes;
const TON: Record<StatutDemande, TonPastille> = {
  A_VALIDER: 'ambre',
  A_TRAITER: 'ambre',
  EN_TRAITEMENT: 'encre',
  TRAITEE: 'vert',
  REFUSEE: 'rouge',
  ANNULEE: 'gris',
};
const GRILLE = 'lg:grid-cols-[100px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_80px_150px_96px]';
const jourMois = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Action principale de la ligne : celle que l'API autorise (valider, traiter), sinon « Voir ». */
function actionLigne(d: Demande): string | null {
  if (d.droits.valider) return 'Valider';
  if (d.droits.prendreEnCharge || d.droits.traiter) return 'Traiter';
  if (d.droits.refuser) return 'Traiter';
  return null;
}

/**
 * Demandes : les miennes, celles à valider (chef), la file des gestionnaires — tableau compact
 * (type, objet, catégorie, demandeur, date, statut) avec « Traiter » sur la ligne quand l'API
 * l'autorise, sinon « Voir ». La vue et la création sont tenues par la page (bouton d'en-tête).
 */
export function OngletDemandes({
  gestionnaire,
  ouvrirId,
  vue,
  onVue,
  creation,
  onCreation,
  onChange,
}: {
  gestionnaire: boolean;
  ouvrirId: string | null;
  vue: Vue;
  onVue: (v: Vue) => void;
  creation: Bien | true | null;
  onCreation: (c: Bien | true | null) => void;
  onChange: () => void;
}) {
  const [liste, setListe] = useState<Demande[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<Demande | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('');

  const charger = useCallback(() => {
    getDemandes(vue)
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, [vue]);
  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    if (ouvrirId) getDemande(ouvrirId).then(setOuverte).catch((e) => setErreur(messageChargement(e)));
  }, [ouvrirId]);

  const options: { cle: Vue; libelle: string }[] = [
    { cle: 'miennes', libelle: 'Mes demandes' },
    { cle: 'a_valider', libelle: 'À valider' },
    ...(gestionnaire ? [{ cle: 'a_traiter' as Vue, libelle: 'À traiter' }] : []),
  ];
  const categories = [...new Map((liste ?? []).map((d) => [d.categorie.id, d.categorie.libelle])).entries()].sort((x, y) => x[1].localeCompare(y[1], 'fr'));
  const q = sansAccents(recherche.trim());
  const affichees = (liste ?? []).filter((d) => (!categorie || d.categorie.id === categorie) && (!q || sansAccents(`${d.objet} ${nom(d.demandeur)} ${d.categorie.libelle}`).includes(q)));

  return (
    <div data-testid="onglet-demandes">
      <ErreurChargement message={erreur} />
      <Info message={info} />
      <BarreOutils>
        <Recherche value={recherche} onChange={setRecherche} placeholder="Rechercher une demande…" label="Rechercher une demande" />
        <SousOnglets valeur={vue} options={options} onChange={onVue} label="Demandes affichées" />
        <FiltreSelect label="Catégorie" value={categorie} defaut="" onChange={setCategorie} options={[{ value: '', label: 'Catégorie : toutes' }, ...categories.map(([id, l]) => ({ value: id, label: l }))]} />
      </BarreOutils>
      {!liste ? null : (
        <Tableau
          label="Demandes logistiques"
          grille={GRILLE}
          colonnes={['Type', 'Objet', 'Catégorie', 'Demandeur', 'Date', 'Statut', <span key="a" className="sr-only">Action</span>]}
          vide={
            <EtatVide
              texte={liste.length ? 'Aucune demande ne correspond à cette recherche.' : 'Aucune demande dans cette rubrique.'}
              action={
                <button type="button" className={BTN_SECONDAIRE} onClick={() => onCreation(true)}>
                  <Plus aria-hidden size={16} />
                  Nouvelle demande
                </button>
              }
            />
          }
        >
          {affichees.map((d) => {
            const action = actionLigne(d);
            return (
              <LigneTableau key={d.id} grille={GRILLE} onClick={() => setOuverte(d)} testid="ligne-demande" label={d.objet}>
                <span className="font-heading text-[12.5px] font-bold text-ink">{TYPE_DEMANDE_LABEL[d.type]}</span>
                <span className="block font-semibold">
                  {d.objet}
                  {d.quantite ? <span className="font-normal text-text-muted"> · {d.quantite}{d.article ? ` ${d.article.unite}` : ''}</span> : null}
                </span>
                <span className="block truncate text-[12.5px] text-text-muted">{d.categorie.libelle}</span>
                <span className="block truncate">{nom(d.demandeur)}</span>
                <span className="text-[12.5px] text-text-muted">{jourMois(d.createdAt)}</span>
                <Pastille ton={TON[d.statut]}>{d.statutLibelle}</Pastille>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`${action ? BTN_LIGNE_PRINCIPAL : BTN_LIGNE} w-full`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOuverte(d);
                  }}
                >
                  {action ?? 'Voir'}
                </button>
              </LigneTableau>
            );
          })}
        </Tableau>
      )}
      {ouverte && (
        <FenetreDemande
          demande={ouverte}
          onClose={() => setOuverte(null)}
          onChange={(d, message) => {
            setOuverte(null);
            setInfo(message);
            charger();
            onChange();
            void d;
          }}
        />
      )}
      {creation && (
        <FenetreNouvelleDemande
          bien={creation === true ? null : creation}
          onClose={() => onCreation(null)}
          onCreated={(d) => {
            onCreation(null);
            setInfo(d.statut === 'A_VALIDER' ? 'Demande envoyée à votre chef pour validation.' : 'Demande transmise aux gestionnaires logistiques.');
            if (vue !== 'miennes') onVue('miennes');
            else charger();
            onChange();
          }}
        />
      )}
    </div>
  );
}

function FenetreNouvelleDemande({ bien, onClose, onCreated }: { bien: Bien | null; onClose: () => void; onCreated: (d: Demande) => void }) {
  const [type, setType] = useState<TypeDemande>(bien ? 'INTERVENTION' : 'FOURNITURE');
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [biens, setBiens] = useState<Bien[]>([]);
  const [v, setV] = useState({ articleId: '', categorieId: '', bienId: bien?.id ?? '', quantite: '1', objet: bien ? `Panne : ${bien.designation}` : '', justification: '' });
  const { enCours, erreur, lancer } = useAction();
  useEffect(() => {
    getArticles().then((a) => setArticles(a.filter((x) => x.actif))).catch(() => setArticles([]));
    getCategories().then((c) => setCategories(c.filter((x) => x.nature === 'BIEN'))).catch(() => setCategories([]));
    getBiens().then((b) => setBiens(b.filter((x) => x.droits.signalerPanne))).catch(() => setBiens([]));
  }, []);
  const article = articles.find((a) => a.id === v.articleId);
  const circuit =
    type === 'FOURNITURE'
      ? article?.categorie.validationChefRequise
      : type === 'MATERIEL'
        ? categories.find((c) => c.id === v.categorieId)?.validationChefRequise
        : undefined;
  return (
    <Fenetre
      titre="Nouvelle demande logistique"
      onClose={onClose}
      valider="Envoyer la demande"
      enCours={enCours}
      onSubmit={async () => {
        const d = await lancer(
          () =>
            creerDemande({
              type,
              objet: v.objet.trim(),
              justification: v.justification.trim() || undefined,
              ...(type === 'FOURNITURE' ? { articleId: v.articleId, quantite: Number(v.quantite) } : {}),
              ...(type === 'MATERIEL' ? { categorieId: v.categorieId, quantite: Number(v.quantite) } : {}),
              ...(type === 'INTERVENTION' ? { bienId: v.bienId } : {}),
            }),
          'Demande impossible',
        );
        if (d) onCreated(d);
      }}
    >
      <Erreur message={erreur} />
      <Champ id="dem-type" label="Type">
        <select id="dem-type" className={SELECT_CLASS} value={type} onChange={(e) => setType(e.target.value as TypeDemande)}>
          {(Object.keys(TYPE_DEMANDE_LABEL) as TypeDemande[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_DEMANDE_LABEL[t]}
            </option>
          ))}
        </select>
      </Champ>
      {type === 'FOURNITURE' && (
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Champ id="dem-article" label="Article">
            <select id="dem-article" className={SELECT_CLASS} value={v.articleId} onChange={(e) => setV({ ...v, articleId: e.target.value })} required>
              <option value="">Choisir…</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle} ({a.categorie.libelle})
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="dem-qte" label={`Quantité${article ? ` (${article.unite})` : ''}`}>
            <input id="dem-qte" type="number" min={1} className={SELECT_CLASS} value={v.quantite} onChange={(e) => setV({ ...v, quantite: e.target.value })} required />
          </Champ>
        </div>
      )}
      {type === 'MATERIEL' && (
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Champ id="dem-cat" label="Catégorie de matériel">
            <select id="dem-cat" className={SELECT_CLASS} value={v.categorieId} onChange={(e) => setV({ ...v, categorieId: e.target.value })} required>
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="dem-qte2" label="Quantité">
            <input id="dem-qte2" type="number" min={1} className={SELECT_CLASS} value={v.quantite} onChange={(e) => setV({ ...v, quantite: e.target.value })} required />
          </Champ>
        </div>
      )}
      {type === 'INTERVENTION' && (
        <Champ id="dem-bien" label="Bien concerné">
          <select id="dem-bien" className={SELECT_CLASS} value={v.bienId} onChange={(e) => setV({ ...v, bienId: e.target.value })} required>
            <option value="">Choisir…</option>
            {biens.map((b) => (
              <option key={b.id} value={b.id}>
                {b.numeroInventaire} — {b.designation}
              </option>
            ))}
          </select>
        </Champ>
      )}
      <Champ id="dem-objet" label="Objet">
        <input id="dem-objet" className={SELECT_CLASS} value={v.objet} onChange={(e) => setV({ ...v, objet: e.target.value })} minLength={3} maxLength={300} required />
      </Champ>
      <Champ id="dem-just" label="Justification (facultatif)">
        <textarea id="dem-just" className={TEXTAREA_CLASS} value={v.justification} onChange={(e) => setV({ ...v, justification: e.target.value })} maxLength={2000} />
      </Champ>
      {circuit !== undefined && (
        <p className="mb-3 text-[12.5px] text-text-muted">{circuit ? 'Circuit : votre chef valide, puis un gestionnaire traite.' : 'Circuit : transmise directement aux gestionnaires.'}</p>
      )}
    </Fenetre>
  );
}

function FenetreDemande({ demande: d, onClose, onChange }: { demande: Demande; onClose: () => void; onChange: (d: Demande, message: string) => void }) {
  const [mode, setMode] = useState<'vue' | 'refus' | 'traitement'>('vue');
  const [motif, setMotif] = useState('');
  const [quantite, setQuantite] = useState(String(d.quantite ?? ''));
  const [compteRendu, setCompteRendu] = useState('');
  const { enCours, erreur, lancer } = useAction();
  const agir = async (fn: () => Promise<Demande>, message: string) => {
    const r = await lancer(fn, 'Action impossible');
    if (r) onChange(r, message);
  };
  const etapes: [string, string | null, string][] = [
    ['Demandée', d.createdAt, nom(d.demandeur)],
    ...(d.validationChef ? ([['Validée par le chef', d.valideeAt, nom(d.valideePar)]] as [string, string | null, string][]) : []),
    ['Prise en charge', d.priseEnChargeAt, nom(d.traiteePar)],
    ['Traitée', d.traiteeAt, nom(d.traiteePar)],
  ];
  if (mode === 'refus') {
    return (
      <Fenetre titre="Rejeter la demande" onClose={() => setMode('vue')} valider="Rejeter" danger enCours={enCours} onSubmit={() => agir(() => refuserDemande(d.id, motif.trim()), 'Demande refusée.')}>
        <Erreur message={erreur} />
        <Champ id="dem-motif" label="Motif (communiqué au demandeur)">
          <textarea id="dem-motif" className={TEXTAREA_CLASS} value={motif} onChange={(e) => setMotif(e.target.value)} minLength={3} required />
        </Champ>
      </Fenetre>
    );
  }
  if (mode === 'traitement') {
    return (
      <Fenetre
        titre="Traiter la demande"
        sousTitre={d.article?.suiviStock ? `La quantité remise sort du stock (${d.article.stock ?? '?'} ${d.article.unite} disponibles).` : undefined}
        onClose={() => setMode('vue')}
        valider="Marquer traitée"
        enCours={enCours}
        onSubmit={() =>
          agir(
            () => traiterDemande(d.id, { quantiteLivree: d.type === 'FOURNITURE' && quantite ? Number(quantite) : undefined, compteRendu: compteRendu.trim() || undefined }),
            'Demande traitée.',
          )
        }
      >
        <Erreur message={erreur} />
        {d.type === 'FOURNITURE' && (
          <Champ id="dem-remis" label={`Quantité remise (demandée : ${d.quantite})`}>
            <input id="dem-remis" type="number" min={1} max={d.quantite ?? undefined} className={SELECT_CLASS} value={quantite} onChange={(e) => setQuantite(e.target.value)} required />
          </Champ>
        )}
        <Champ id="dem-cr" label="Compte rendu (facultatif)">
          <textarea id="dem-cr" className={TEXTAREA_CLASS} value={compteRendu} onChange={(e) => setCompteRendu(e.target.value)} />
        </Champ>
      </Fenetre>
    );
  }
  const actions = d.droits;
  const premiereAFaire = etapes.findIndex(([, at]) => !at);
  const arret = d.statut === 'REFUSEE' || d.statut === 'ANNULEE';
  const boutons = [
    actions.valider && (
      <button key="v" type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => agir(() => validerDemande(d.id), 'Demande validée : transmise aux gestionnaires.')}>
        Valider
      </button>
    ),
    actions.prendreEnCharge && (
      <button key="p" type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => agir(() => prendreEnCharge(d.id), 'Demande prise en charge.')}>
        Prendre en charge
      </button>
    ),
    actions.traiter && (
      <button key="t" type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => setMode('traitement')}>
        Traiter
      </button>
    ),
    actions.refuser && (
      <button key="r" type="button" className={`${BTN_DANGER_CONTOUR} w-full`} disabled={enCours} onClick={() => setMode('refus')}>
        Rejeter avec un motif
      </button>
    ),
    actions.annuler && (
      <button key="a" type="button" className={`${BTN_SECONDAIRE} w-full`} disabled={enCours} onClick={() => agir(() => annulerDemande(d.id), 'Demande annulée.')}>
        Annuler ma demande
      </button>
    ),
  ].filter(Boolean);
  return (
    <Panneau
      titre={d.objet}
      filAriane={['Logistique', 'Demandes', TYPE_DEMANDE_LABEL[d.type]]}
      sousTitre={
        <Etapes
          label="Circuit de la demande"
          etapes={etapes.map(([l, at], i) => ({ label: l, etat: at ? 'fait' : !arret && i === premiereAFaire ? 'courant' : 'avenir' }))}
        />
      }
      onClose={onClose}
      testid="fiche-demande"
      cote={
        <>
          {boutons.length > 0 && <div className="mb-[18px] grid gap-2">{boutons}</div>}
          <SectionFenetre titre="Informations" className="">
            <CleValeur
              largeur={96}
              lignes={[
                ['Statut', <Pastille key="s" ton={TON[d.statut]}>{d.statutLibelle}</Pastille>],
                ['Demandeur', nom(d.demandeur)],
                ['Catégorie', d.categorie.libelle],
                ['Déposée le', dateCourte(d.createdAt)],
              ]}
            />
          </SectionFenetre>
        </>
      }
    >
      <Erreur message={erreur} />
      <SectionFenetre titre="Demande">
        <CleValeur
          largeur={120}
          lignes={
            [
              d.article ? ['Article', `${d.article.libelle} — ${d.quantite} ${d.article.unite}${d.quantiteLivree !== null ? ` (remis : ${d.quantiteLivree})` : ''}`] : null,
              d.type === 'MATERIEL' ? ['Quantité', String(d.quantite ?? '')] : null,
              d.bien ? ['Bien', `${d.bien.numeroInventaire} — ${d.bien.designation}`] : null,
              ['Justification', d.justification ? <span key="j" className="whitespace-pre-wrap font-normal">{d.justification}</span> : <span key="j" className="font-normal text-text-muted">Aucune</span>],
              d.compteRendu ? ['Compte rendu', <span key="c" className="whitespace-pre-wrap font-normal">{d.compteRendu}</span>] : null,
              d.motifRefus ? ['Refus', <span key="m" className="text-clay">{d.motifRefus} ({nom(d.refuseePar)})</span>] : null,
            ].filter(Boolean) as [ReactNode, ReactNode][]
          }
        />
      </SectionFenetre>
      <SectionFenetre titre="Historique" className="">
        <ol className="space-y-1.5 border-l-2 border-line pl-3 text-[13px]" data-testid="etapes-demande">
          {etapes.map(([l, at, qui]) => (
            <li key={l} className={at ? 'text-text' : 'text-text-muted'}>
              <b className="font-semibold">{l}</b>
              {at ? ` — ${dateHeure(at)}${qui ? `, ${qui}` : ''}` : ' — à venir'}
            </li>
          ))}
        </ol>
      </SectionFenetre>
    </Panneau>
  );
}
