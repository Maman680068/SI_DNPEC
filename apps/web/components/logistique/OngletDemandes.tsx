'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  annulerDemande,
  creerDemande,
  exporterDemandes,
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
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Champ, Info, Panneau, SousOnglets, Vide, dateCourte, dateHeure, nom, useAction } from './commun';

type Vue = 'miennes' | 'a_valider' | 'a_traiter';
const TON: Record<StatutDemande, 'gold' | 'sage' | 'clay' | 'muted' | 'accent'> = {
  A_VALIDER: 'gold',
  A_TRAITER: 'gold',
  EN_TRAITEMENT: 'accent',
  TRAITEE: 'sage',
  REFUSEE: 'clay',
  ANNULEE: 'muted',
};

/** Demandes : les miennes, celles à valider (chef), la file des gestionnaires. */
export function OngletDemandes({ gestionnaire, ouvrirId, nouvelleIntervention, onChange }: { gestionnaire: boolean; ouvrirId: string | null; nouvelleIntervention: Bien | null; onChange: () => void }) {
  const [vue, setVue] = useState<Vue>('miennes');
  const [liste, setListe] = useState<Demande[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<Demande | null>(null);
  const [creation, setCreation] = useState<Bien | true | null>(nouvelleIntervention);
  const [info, setInfo] = useState<string | null>(null);

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
  useEffect(() => {
    if (nouvelleIntervention) setCreation(nouvelleIntervention);
  }, [nouvelleIntervention]);

  const options: { cle: Vue; libelle: string }[] = [
    { cle: 'miennes', libelle: 'Mes demandes' },
    { cle: 'a_valider', libelle: 'À valider' },
    ...(gestionnaire ? [{ cle: 'a_traiter' as Vue, libelle: 'À traiter' }] : []),
  ];

  return (
    <div data-testid="onglet-demandes">
      <ErreurChargement message={erreur} />
      <Info message={info} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SousOnglets valeur={vue} options={options} onChange={setVue} />
        <div className="flex gap-2">
          <Button onClick={() => void exporterDemandes(vue)}>Exporter</Button>
          <Button variant="gold" onClick={() => setCreation(true)}>
            + Nouvelle demande
          </Button>
        </div>
      </div>
      {!liste ? null : liste.length === 0 ? (
        <Vide>Aucune demande dans cette rubrique.</Vide>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {liste.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => setOuverte(d)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bg" data-testid="ligne-demande">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{d.objet}</div>
                  <div className="text-[12.5px] text-text-muted">
                    {TYPE_DEMANDE_LABEL[d.type]} · {d.categorie.libelle}
                    {d.quantite ? ` · ${d.quantite}${d.article ? ` ${d.article.unite}` : ''}` : ''} · {nom(d.demandeur)} · {dateCourte(d.createdAt)}
                  </div>
                </div>
                <Badge tone={TON[d.statut]}>{d.statutLibelle}</Badge>
              </button>
            </li>
          ))}
        </ul>
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
          onClose={() => setCreation(null)}
          onCreated={(d) => {
            setCreation(null);
            setInfo(d.statut === 'A_VALIDER' ? 'Demande envoyée à votre chef pour validation.' : 'Demande transmise aux gestionnaires logistiques.');
            setVue('miennes');
            charger();
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
      <Fenetre titre="Refuser la demande" onClose={() => setMode('vue')} valider="Refuser" danger enCours={enCours} onSubmit={() => agir(() => refuserDemande(d.id, motif.trim()), 'Demande refusée.')}>
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
  return (
    <Panneau titre={d.objet} sousTitre={`${TYPE_DEMANDE_LABEL[d.type]} · ${d.categorie.libelle} — ${d.statutLibelle}`} onClose={onClose} testid="fiche-demande">
      <Erreur message={erreur} />
      <dl className="mb-3 grid grid-cols-[120px_1fr] gap-y-1 text-[13px]">
        <dt className="text-text-muted">Demandeur</dt>
        <dd>{nom(d.demandeur)}</dd>
        {d.article && (
          <>
            <dt className="text-text-muted">Article</dt>
            <dd>
              {d.article.libelle} — {d.quantite} {d.article.unite}
              {d.quantiteLivree !== null ? ` (remis : ${d.quantiteLivree})` : ''}
            </dd>
          </>
        )}
        {d.type === 'MATERIEL' && (
          <>
            <dt className="text-text-muted">Quantité</dt>
            <dd>{d.quantite}</dd>
          </>
        )}
        {d.bien && (
          <>
            <dt className="text-text-muted">Bien</dt>
            <dd>
              {d.bien.numeroInventaire} — {d.bien.designation}
            </dd>
          </>
        )}
        {d.justification && (
          <>
            <dt className="text-text-muted">Justification</dt>
            <dd className="whitespace-pre-wrap">{d.justification}</dd>
          </>
        )}
        {d.compteRendu && (
          <>
            <dt className="text-text-muted">Compte rendu</dt>
            <dd className="whitespace-pre-wrap">{d.compteRendu}</dd>
          </>
        )}
        {d.motifRefus && (
          <>
            <dt className="text-text-muted">Refus</dt>
            <dd className="text-clay">
              {d.motifRefus} ({nom(d.refuseePar)})
            </dd>
          </>
        )}
      </dl>
      <ol className="mb-4 border-l-2 border-line pl-3 text-[12.5px]" data-testid="etapes-demande">
        {etapes.map(([l, at, qui]) => (
          <li key={l} className={at ? 'text-text' : 'text-text-faint'}>
            {at ? '✓' : '○'} {l}
            {at ? ` — ${dateHeure(at)}${qui ? `, ${qui}` : ''}` : ''}
          </li>
        ))}
      </ol>
      {(actions.valider || actions.refuser || actions.prendreEnCharge || actions.traiter || actions.annuler) && (
        <div className="mb-2 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          {actions.annuler && (
            <Button type="button" disabled={enCours} onClick={() => agir(() => annulerDemande(d.id), 'Demande annulée.')}>
              Annuler ma demande
            </Button>
          )}
          {actions.refuser && (
            <Button type="button" disabled={enCours} onClick={() => setMode('refus')}>
              Refuser
            </Button>
          )}
          {actions.valider && (
            <Button type="button" variant="gold" disabled={enCours} onClick={() => agir(() => validerDemande(d.id), 'Demande validée : transmise aux gestionnaires.')}>
              Valider
            </Button>
          )}
          {actions.prendreEnCharge && (
            <Button type="button" variant="gold" disabled={enCours} onClick={() => agir(() => prendreEnCharge(d.id), 'Demande prise en charge.')}>
              Prendre en charge
            </Button>
          )}
          {actions.traiter && (
            <Button type="button" variant="gold" disabled={enCours} onClick={() => setMode('traitement')}>
              Traiter
            </Button>
          )}
        </div>
      )}
    </Panneau>
  );
}
