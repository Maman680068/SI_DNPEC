'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { creerArticle, getArticles, getCategories, getMouvementsStock, modifierArticle, mouvementStock } from '../../lib/api/logistique';
import type { Article, Categorie, MouvementStock } from '../../lib/logistique/types';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { BTN_PRINCIPAL, BTN_SECONDAIRE, BarreOutils, EtatVide, Filtres, FiltreSelect, LigneTableau, Pastille, Recherche, Tableau } from '../ui/Charte';
import { Case, FenetreFormulaire, Grille2, Liste, Saisie } from '../ui/Formulaire';
import { Barre, SqueletteListe } from '../ui/Squelette';
import { useToast } from '../ui/Toast';
import { useEnvoi } from '../courrier/formulaire';
import { Panneau, dateHeure, nom } from './commun';

const GRILLE = 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_170px]';

/** Fournitures (gestionnaires) : articles, stock suivi ou non, entrées et sorties. */
export function OngletFournitures({ ouvrirId }: { ouvrirId: string | null }) {
  const toast = useToast();
  const [liste, setListe] = useState<Article[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<Article | 'nouveau' | null>(null);
  const [ouvert, setOuvert] = useState<Article | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState<'TOUS' | 'SOUS_SEUIL'>('TOUS');
  const q = recherche.trim().toLowerCase();
  const affiches = (liste ?? []).filter((a) => (filtre === 'TOUS' || a.sousSeuil) && (!q || `${a.libelle} ${a.categorie.libelle}`.toLowerCase().includes(q)));
  const charger = useCallback(() => {
    getArticles()
      .then((l) => {
        setListe(l);
        if (ouvrirId) setOuvert((o) => o ?? l.find((a) => a.id === ouvrirId) ?? null);
      })
      .catch((e) => setErreur(messageChargement(e)));
  }, [ouvrirId]);
  useEffect(() => {
    charger();
  }, [charger]);
  return (
    <div data-testid="onglet-fournitures">
      <ErreurChargement message={erreur} />
      <BarreOutils
        droite={
          <button type="button" className={BTN_PRINCIPAL} onClick={() => setEdition('nouveau')}>
            <Plus aria-hidden size={17} />
            Nouvel article
          </button>
        }
      >
        <Recherche value={recherche} onChange={setRecherche} placeholder="Rechercher un article…" label="Rechercher un article" />
        <Filtres actifs={filtre === 'TOUS' ? 0 : 1} onEffacer={() => setFiltre('TOUS')}>
          <FiltreSelect label="Stock" value={filtre} defaut="TOUS" onChange={setFiltre} options={[{ value: 'TOUS', label: 'Stock : tous' }, { value: 'SOUS_SEUIL', label: 'Sous le seuil' }]} />
        </Filtres>
      </BarreOutils>
      {!liste && !erreur && <SqueletteListe lignes={5} colonnes={4} />}
      {liste && (
        <Tableau label="Articles de fournitures" grille={GRILLE} colonnes={['Article', 'Catégorie', 'Suivi', 'Stock']} vide={<EtatVide texte={liste.length ? 'Aucun article ne correspond.' : 'Aucun article.'} />}>
          {affiches.map((a) => (
            <LigneTableau key={a.id} grille={GRILLE} onClick={() => setOuvert(a)} testid="ligne-article" label={a.libelle}>
              <span className="block font-semibold">
                {a.libelle} {!a.actif && <Pastille ton="gris">Inactif</Pastille>}
              </span>
              <span className="block truncate text-[12.5px] text-text-muted">{a.categorie.libelle}</span>
              <span className="text-[12.5px] text-text-muted">{a.suiviStock ? `Stock suivi${a.seuilAlerte !== null ? `, seuil ${a.seuilAlerte}` : ''}` : 'Au cas par cas'}</span>
              {a.suiviStock ? (
                <Pastille ton={a.sousSeuil ? 'rouge' : 'vert'}>
                  {a.stock} {a.unite}
                  {a.sousSeuil ? ' — sous le seuil' : ''}
                </Pastille>
              ) : (
                <span className="text-[12.5px] text-text-muted">—</span>
              )}
            </LigneTableau>
          ))}
        </Tableau>
      )}
      {ouvert && (
        <FicheArticle
          article={ouvert}
          onClose={() => setOuvert(null)}
          onModifier={() => {
            setEdition(ouvert);
            setOuvert(null);
          }}
          onChange={(a, m) => {
            setOuvert(a);
            toast.succes(m.titre, { detail: m.detail });
            charger();
          }}
        />
      )}
      {edition && (
        <FenetreArticle
          article={edition === 'nouveau' ? null : edition}
          onClose={() => setEdition(null)}
          onDone={(m) => {
            setEdition(null);
            toast.succes(m);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FicheArticle({ article: a, onClose, onModifier, onChange }: { article: Article; onClose: () => void; onModifier: () => void; onChange: (a: Article, m: { titre: string; detail?: string }) => void }) {
  const [mouvements, setMouvements] = useState<MouvementStock[] | null>(null);
  const [mv, setMv] = useState<'ENTREE' | 'SORTIE' | null>(null);
  useEffect(() => {
    if (a.suiviStock) getMouvementsStock(a.id).then(setMouvements).catch(() => setMouvements([]));
  }, [a]);
  if (mv) return <FenetreMouvement article={a} type={mv} onClose={() => setMv(null)} onDone={(na) => { setMv(null); onChange(na, { titre: mv === 'ENTREE' ? 'Entrée en stock enregistrée' : 'Sortie de stock enregistrée', detail: `Stock : ${na.stock} ${na.unite}.` }); }} />;
  return (
    <Panneau titre={a.libelle} filAriane={['Logistique', 'Fournitures']} sousTitre={`${a.categorie.libelle} · ${a.suiviStock ? `${a.stock} ${a.unite} en stock` : 'stock non suivi'}`} onClose={onClose} testid="fiche-article">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button type="button" className={BTN_SECONDAIRE} onClick={onModifier}>
          Modifier
        </button>
        {a.suiviStock && (
          <>
            <button type="button" className={BTN_SECONDAIRE} onClick={() => setMv('SORTIE')}>
              Sortie
            </button>
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setMv('ENTREE')}>
              Entrée
            </button>
          </>
        )}
      </div>
      {a.suiviStock && (
        <>
          <h3 className="mb-1.5 text-[13px] font-bold">Mouvements</h3>
          {mouvements === null && (
            <div role="status" aria-label="Chargement en cours" className="space-y-2 py-1" data-testid="squelette">
              <span className="sr-only">Chargement en cours</span>
              <Barre className="h-3 w-[70%]" />
              <Barre className="h-3 w-[55%]" />
            </div>
          )}
          {mouvements && mouvements.length === 0 && <p className="text-[12.5px] text-text-faint">Aucun mouvement.</p>}
          <ul className="text-[12.5px]">
            {mouvements?.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 border-t border-line py-1.5">
                <span>
                  <strong className={m.type === 'ENTREE' ? 'text-sage' : 'text-clay'}>
                    {m.type === 'ENTREE' ? '+' : '−'}
                    {m.quantite}
                  </strong>{' '}
                  {m.motif ?? ''} <span className="text-text-faint">({nom(m.par)})</span>
                </span>
                <span className="text-text-muted">
                  {dateHeure(m.createdAt)} — reste {m.stockApres}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panneau>
  );
}

function FenetreMouvement({ article, type, onClose, onDone }: { article: Article; type: 'ENTREE' | 'SORTIE'; onClose: () => void; onDone: (a: Article) => void }) {
  const [quantite, setQuantite] = useState('');
  const [motif, setMotif] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const sortie = type === 'SORTIE';
  return (
    <FenetreFormulaire
      titre={`${sortie ? 'Sortie de stock' : 'Entrée en stock'} — ${article.libelle}`}
      sousTitre={`Stock actuel : ${article.stock} ${article.unite}.`}
      onClose={onClose}
      libelleValider={sortie ? 'Enregistrer la sortie' : 'Enregistrer l’entrée'}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      pied="Le mouvement est daté et tracé ; le stock ne peut jamais devenir négatif."
      valider={() => ({
        ...(quantite && !(Number.isInteger(Number(quantite)) && Number(quantite) >= 1) ? { 'mv-qte': 'Indiquez une quantité entière, au moins 1.' } : {}),
        ...(sortie && quantite && article.stock !== null && Number(quantite) > article.stock ? { 'mv-qte': `Le stock ne compte que ${article.stock} ${article.unite}.` } : {}),
      })}
      onSubmit={async () => {
        const r = await envoyer(() => mouvementStock(article.id, { type, quantite: Number(quantite), motif: motif.trim() || undefined }));
        if (r.ok) onDone(r.valeur);
      }}
    >
      <Grille2>
        <Saisie id="mv-qte" label={`Quantité (${article.unite})`} type="number" min={1} value={quantite} onChange={setQuantite} required messageObligatoire="Indiquez la quantité." />
        <Saisie id="mv-motif" label="Motif" facultatif={!sortie} value={motif} onChange={setMotif} required={sortie} messageObligatoire="Indiquez le motif de la sortie." />
      </Grille2>
    </FenetreFormulaire>
  );
}

function FenetreArticle({ article, onClose, onDone }: { article: Article | null; onClose: () => void; onDone: (m: string) => void }) {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [v, setV] = useState({
    categorieId: article?.categorieId ?? '',
    libelle: article?.libelle ?? '',
    unite: article?.unite ?? 'unité',
    suiviStock: article?.suiviStock ?? false,
    seuilAlerte: article?.seuilAlerte !== null && article?.seuilAlerte !== undefined ? String(article.seuilAlerte) : '',
    actif: article?.actif ?? true,
  });
  const { enCours, erreur, envoyer } = useEnvoi();
  useEffect(() => {
    getCategories().then((c) => setCategories(c.filter((x) => x.nature === 'FOURNITURE'))).catch(() => setCategories([]));
  }, []);
  return (
    <FenetreFormulaire
      titre={article ? `Modifier ${article.libelle}` : 'Nouvel article'}
      onClose={onClose}
      libelleValider={article ? 'Enregistrer' : 'Créer l’article'}
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      pied="Un article actif est proposé aux demandeurs de fournitures."
      valider={() => ({
        ...(v.libelle.trim().length === 1 ? { 'ar-lib': 'Indiquez au moins 2 caractères.' } : {}),
        ...(v.suiviStock && v.seuilAlerte && !(Number.isInteger(Number(v.seuilAlerte)) && Number(v.seuilAlerte) >= 0) ? { 'ar-seuil': 'Indiquez un nombre entier, 0 ou plus.' } : {}),
      })}
      onSubmit={async () => {
        const seuil = v.suiviStock && v.seuilAlerte !== '' ? Number(v.seuilAlerte) : null;
        const r = await envoyer(() =>
          article
            ? modifierArticle(article.id, { libelle: v.libelle.trim(), unite: v.unite.trim(), suiviStock: v.suiviStock, seuilAlerte: seuil, actif: v.actif })
            : creerArticle({ categorieId: v.categorieId, libelle: v.libelle.trim(), unite: v.unite.trim(), suiviStock: v.suiviStock, seuilAlerte: seuil }),
        );
        if (r.ok) onDone(article ? 'Article modifié' : 'Article créé');
      }}
    >
      {!article && (
        <Liste
          id="ar-cat"
          label="Catégorie"
          value={v.categorieId}
          onChange={(categorieId) => setV({ ...v, categorieId })}
          vide="Choisir…"
          options={categories.map((c) => ({ value: c.id, label: c.libelle }))}
          required
          messageObligatoire="Choisissez la catégorie."
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-x-3">
        <Saisie id="ar-lib" label="Libellé" value={v.libelle} onChange={(libelle) => setV({ ...v, libelle })} required maxLength={200} messageObligatoire="Indiquez le libellé de l’article." />
        <Saisie id="ar-unite" label="Unité" value={v.unite} onChange={(unite) => setV({ ...v, unite })} required maxLength={40} messageObligatoire="Indiquez l’unité." />
      </div>
      <Case id="ar-suivi" label="Suivre le stock (entrées, sorties, alerte)" checked={v.suiviStock} onChange={(suiviStock) => setV({ ...v, suiviStock })} />
      {v.suiviStock && <Saisie id="ar-seuil" label="Seuil d’alerte" facultatif type="number" min={0} value={v.seuilAlerte} onChange={(seuilAlerte) => setV({ ...v, seuilAlerte })} />}
      {article && <Case id="ar-actif" label="Proposé aux demandeurs" checked={v.actif} onChange={(actif) => setV({ ...v, actif })} />}
    </FenetreFormulaire>
  );
}
