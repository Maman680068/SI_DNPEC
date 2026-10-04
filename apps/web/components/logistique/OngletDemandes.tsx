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
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { ChoixSegment, FenetreFormulaire, Grille2, Liste, Saisie, ZoneTexte } from '../ui/Formulaire';
import { SqueletteListe } from '../ui/Squelette';
import { messageErreur, useToast } from '../ui/Toast';
import { useEnvoi } from '../courrier/formulaire';
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
  Filtres,
  FiltreSelect,
  LigneTableau,
  Pastille,
  Recherche,
  SectionFenetre,
  Tableau,
  type TonPastille,
} from '../ui/Charte';
import { Panneau, SousOnglets, dateCourte, dateHeure, nom, useAction } from './commun';

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
  const toast = useToast();
  const [ouverte, setOuverte] = useState<Demande | null>(null);
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
      <BarreOutils>
        <Recherche value={recherche} onChange={setRecherche} placeholder="Rechercher une demande…" label="Rechercher une demande" />
        <SousOnglets valeur={vue} options={options} onChange={onVue} label="Demandes affichées" />
        <Filtres actifs={categorie ? 1 : 0} onEffacer={() => setCategorie('')}>
          <FiltreSelect label="Catégorie" value={categorie} defaut="" onChange={setCategorie} options={[{ value: '', label: 'Catégorie : toutes' }, ...categories.map(([id, l]) => ({ value: id, label: l }))]} />
        </Filtres>
      </BarreOutils>
      {!liste ? (
        !erreur && <SqueletteListe lignes={6} colonnes={6} />
      ) : (
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
            toast.succes(message.titre, { detail: message.detail });
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
            toast.succes('Demande envoyée', {
              detail: d.statut === 'A_VALIDER' ? 'Votre chef est prévenu pour la valider.' : 'Transmise directement aux gestionnaires logistiques.',
              annuler: async () => {
                try {
                  await annulerDemande(d.id);
                  toast.succes('Demande annulée');
                } catch (e) {
                  toast.erreur('Annulation impossible', messageErreur(e));
                }
                charger();
                onChange();
              },
            });
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
  const { enCours, erreur, envoyer } = useEnvoi();
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
  const quantite = type === 'FOURNITURE' || type === 'MATERIEL';
  return (
    <FenetreFormulaire
      titre="Nouvelle demande logistique"
      libelleValider="Envoyer la demande"
      largeur={720}
      testid="fenetre-nouvelle-demande"
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied={
        circuit === undefined
          ? type === 'INTERVENTION'
            ? 'Les gestionnaires logistiques sont prévenus.'
            : 'Le circuit dépend de la catégorie choisie.'
          : circuit
            ? 'Circuit : votre chef valide, puis un gestionnaire traite.'
            : 'Circuit : transmise directement aux gestionnaires.'
      }
      valider={() => ({
        ...(quantite && v.quantite && !(Number.isInteger(Number(v.quantite)) && Number(v.quantite) >= 1) ? { 'dem-qte': 'Indiquez une quantité entière, au moins 1.' } : {}),
        ...(v.objet.trim() && v.objet.trim().length < 3 ? { 'dem-objet': 'Décrivez l’objet en 3 caractères au moins.' } : {}),
      })}
      onSubmit={async () => {
        const r = await envoyer(() =>
          creerDemande({
            type,
            objet: v.objet.trim(),
            justification: v.justification.trim() || undefined,
            ...(type === 'FOURNITURE' ? { articleId: v.articleId, quantite: Number(v.quantite) } : {}),
            ...(type === 'MATERIEL' ? { categorieId: v.categorieId, quantite: Number(v.quantite) } : {}),
            ...(type === 'INTERVENTION' ? { bienId: v.bienId } : {}),
          }),
        );
        if (r.ok) onCreated(r.valeur);
      }}
    >
      <ChoixSegment<TypeDemande> id="dem-type" label="Type" value={type} onChange={setType} options={(Object.keys(TYPE_DEMANDE_LABEL) as TypeDemande[]).map((t) => ({ value: t, label: TYPE_DEMANDE_LABEL[t] }))} />
      {type === 'FOURNITURE' && (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-x-3">
          <Liste
            id="dem-article"
            label="Article"
            value={v.articleId}
            onChange={(articleId) => setV({ ...v, articleId })}
            vide="Choisir…"
            options={articles.map((a) => ({ value: a.id, label: `${a.libelle} (${a.categorie.libelle})` }))}
            required
            messageObligatoire="Choisissez l’article."
          />
          <Saisie id="dem-qte" label={`Quantité${article ? ` (${article.unite})` : ''}`} type="number" min={1} value={v.quantite} onChange={(q) => setV({ ...v, quantite: q })} required messageObligatoire="Indiquez la quantité." />
        </div>
      )}
      {type === 'MATERIEL' && (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-x-3">
          <Liste
            id="dem-cat"
            label="Catégorie de matériel"
            value={v.categorieId}
            onChange={(categorieId) => setV({ ...v, categorieId })}
            vide="Choisir…"
            options={categories.map((c) => ({ value: c.id, label: c.libelle }))}
            required
            messageObligatoire="Choisissez la catégorie de matériel."
          />
          <Saisie id="dem-qte" label="Quantité" type="number" min={1} value={v.quantite} onChange={(q) => setV({ ...v, quantite: q })} required messageObligatoire="Indiquez la quantité." />
        </div>
      )}
      {type === 'INTERVENTION' && (
        <Liste
          id="dem-bien"
          label="Bien concerné"
          value={v.bienId}
          onChange={(bienId) => setV({ ...v, bienId })}
          vide="Choisir…"
          options={biens.map((b) => ({ value: b.id, label: `${b.numeroInventaire} — ${b.designation}` }))}
          required
          messageObligatoire="Choisissez le bien concerné."
        />
      )}
      <Saisie id="dem-objet" label="Objet" value={v.objet} onChange={(objet) => setV({ ...v, objet })} required maxLength={300} messageObligatoire="Indiquez l’objet de la demande." />
      <ZoneTexte id="dem-just" label="Justification" facultatif value={v.justification} onChange={(justification) => setV({ ...v, justification })} maxLength={2000} />
    </FenetreFormulaire>
  );
}

type Message = { titre: string; detail?: string };

function FenetreDemande({ demande: d, onClose, onChange }: { demande: Demande; onClose: () => void; onChange: (d: Demande, message: Message) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'vue' | 'refus' | 'traitement'>('vue');
  const [motif, setMotif] = useState('');
  const [quantite, setQuantite] = useState(String(d.quantite ?? ''));
  const [compteRendu, setCompteRendu] = useState('');
  const { enCours, lancer } = useAction();
  const fenetre = useEnvoi();
  /** Action directe (bouton de la fiche) : erreur en message bref, jamais technique. */
  const agir = async (fn: () => Promise<Demande>, message: Message) => {
    const r = await lancer(fn, 'Action impossible');
    if (r.ok) onChange(r.valeur, message);
    else toast.erreur('Action impossible', r.erreur);
  };
  /** Action d'une fenêtre (motif, traitement) : erreur en bas de la fenêtre. */
  const agirFenetre = async (fn: () => Promise<Demande>, message: Message) => {
    const r = await fenetre.envoyer(fn);
    if (r.ok) onChange(r.valeur, message);
  };
  const etapes: [string, string | null, string][] = [
    ['Demandée', d.createdAt, nom(d.demandeur)],
    ...(d.validationChef ? ([['Validée par le chef', d.valideeAt, nom(d.valideePar)]] as [string, string | null, string][]) : []),
    ['Prise en charge', d.priseEnChargeAt, nom(d.traiteePar)],
    ['Traitée', d.traiteeAt, nom(d.traiteePar)],
  ];
  if (mode === 'refus') {
    return (
      <FenetreFormulaire
        titre="Rejeter la demande"
        sousTitre={`« ${d.objet} » — ${nom(d.demandeur)}`}
        onClose={() => setMode('vue')}
        libelleValider="Rejeter"
        danger
        largeur={560}
        enCours={fenetre.enCours}
        erreur={fenetre.erreur}
        pied="Le demandeur est prévenu avec votre motif."
        valider={() => (motif.trim() && motif.trim().length < 3 ? { 'dem-motif': 'Le motif doit compter au moins 3 caractères.' } : {})}
        onSubmit={() => agirFenetre(() => refuserDemande(d.id, motif.trim()), { titre: 'Demande rejetée', detail: `${nom(d.demandeur)} est prévenu(e) avec votre motif.` })}
      >
        <ZoneTexte id="dem-motif" label="Motif (communiqué au demandeur)" value={motif} onChange={setMotif} required messageObligatoire="Indiquez le motif du rejet." />
      </FenetreFormulaire>
    );
  }
  if (mode === 'traitement') {
    return (
      <FenetreFormulaire
        titre="Traiter la demande"
        sousTitre={d.article?.suiviStock ? `La quantité remise sort du stock (${d.article.stock ?? '?'} ${d.article.unite} disponibles).` : `« ${d.objet} »`}
        onClose={() => setMode('vue')}
        libelleValider="Marquer traitée"
        largeur={560}
        enCours={fenetre.enCours}
        erreur={fenetre.erreur}
        pied={`${nom(d.demandeur)} est prévenu(e) du traitement.`}
        valider={() =>
          d.type === 'FOURNITURE' && quantite && !(Number.isInteger(Number(quantite)) && Number(quantite) >= 1 && Number(quantite) <= (d.quantite ?? Infinity))
            ? { 'dem-remis': `Indiquez une quantité entière entre 1 et ${d.quantite}.` }
            : {}
        }
        onSubmit={() =>
          agirFenetre(
            () => traiterDemande(d.id, { quantiteLivree: d.type === 'FOURNITURE' && quantite ? Number(quantite) : undefined, compteRendu: compteRendu.trim() || undefined }),
            { titre: 'Demande traitée', detail: `${nom(d.demandeur)} est prévenu(e).` },
          )
        }
      >
        {d.type === 'FOURNITURE' && (
          <Saisie id="dem-remis" label={`Quantité remise (demandée : ${d.quantite})`} type="number" min={1} max={d.quantite ?? undefined} value={quantite} onChange={setQuantite} required messageObligatoire="Indiquez la quantité remise." />
        )}
        <ZoneTexte id="dem-cr" label="Compte rendu" facultatif value={compteRendu} onChange={setCompteRendu} />
      </FenetreFormulaire>
    );
  }
  const actions = d.droits;
  const premiereAFaire = etapes.findIndex(([, at]) => !at);
  const arret = d.statut === 'REFUSEE' || d.statut === 'ANNULEE';
  const boutons = [
    actions.valider && (
      <button key="v" type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => agir(() => validerDemande(d.id), { titre: 'Demande validée', detail: 'Transmise aux gestionnaires logistiques.' })}>
        Valider
      </button>
    ),
    actions.prendreEnCharge && (
      <button key="p" type="button" className={`${BTN_PRINCIPAL} w-full`} disabled={enCours} onClick={() => agir(() => prendreEnCharge(d.id), { titre: 'Demande prise en charge', detail: `${nom(d.demandeur)} voit qu’elle est en traitement.` })}>
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
      <button key="a" type="button" className={`${BTN_SECONDAIRE} w-full`} disabled={enCours} onClick={() => agir(() => annulerDemande(d.id), { titre: 'Demande annulée' })}>
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
