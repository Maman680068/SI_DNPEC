'use client';

import { useCallback, useEffect, useState } from 'react';
import { creerArticle, getArticles, getCategories, getMouvementsStock, modifierArticle, mouvementStock } from '../../lib/api/logistique';
import type { Article, Categorie, MouvementStock } from '../../lib/logistique/types';
import { Erreur, Fenetre, SELECT_CLASS } from '../courrier/ui';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Champ, Info, Panneau, Vide, dateHeure, nom, useAction } from './commun';

/** Fournitures (gestionnaires) : articles, stock suivi ou non, entrées et sorties. */
export function OngletFournitures({ ouvrirId }: { ouvrirId: string | null }) {
  const [liste, setListe] = useState<Article[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<Article | 'nouveau' | null>(null);
  const [ouvert, setOuvert] = useState<Article | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
      <Info message={info} />
      <div className="mb-3 flex justify-end">
        <Button variant="gold" onClick={() => setEdition('nouveau')}>
          + Nouvel article
        </Button>
      </div>
      {liste && liste.length === 0 && <Vide>Aucun article.</Vide>}
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {liste?.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setOuvert(a)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bg" data-testid="ligne-article">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">
                  {a.libelle} {!a.actif && <Badge tone="muted">Inactif</Badge>}
                </div>
                <div className="text-[12.5px] text-text-muted">
                  {a.categorie.libelle} · {a.suiviStock ? `stock suivi${a.seuilAlerte !== null ? `, seuil ${a.seuilAlerte}` : ''}` : 'au cas par cas'}
                </div>
              </div>
              {a.suiviStock && (
                <Badge tone={a.sousSeuil ? 'clay' : 'sage'}>
                  {a.stock} {a.unite}
                  {a.sousSeuil ? ' — sous le seuil' : ''}
                </Badge>
              )}
            </button>
          </li>
        ))}
      </ul>
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
            setInfo(m);
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
            setInfo(m);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FicheArticle({ article: a, onClose, onModifier, onChange }: { article: Article; onClose: () => void; onModifier: () => void; onChange: (a: Article, m: string) => void }) {
  const [mouvements, setMouvements] = useState<MouvementStock[] | null>(null);
  const [mv, setMv] = useState<'ENTREE' | 'SORTIE' | null>(null);
  useEffect(() => {
    if (a.suiviStock) getMouvementsStock(a.id).then(setMouvements).catch(() => setMouvements([]));
  }, [a]);
  if (mv) return <FenetreMouvement article={a} type={mv} onClose={() => setMv(null)} onDone={(na) => { setMv(null); onChange(na, mv === 'ENTREE' ? 'Entrée enregistrée.' : 'Sortie enregistrée.'); }} />;
  return (
    <Panneau titre={a.libelle} sousTitre={`${a.categorie.libelle} · ${a.suiviStock ? `${a.stock} ${a.unite} en stock` : 'stock non suivi'}`} onClose={onClose} testid="fiche-article">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button onClick={onModifier}>Modifier</Button>
        {a.suiviStock && (
          <>
            <Button onClick={() => setMv('SORTIE')}>Sortie</Button>
            <Button variant="gold" onClick={() => setMv('ENTREE')}>
              Entrée
            </Button>
          </>
        )}
      </div>
      {a.suiviStock && (
        <>
          <h3 className="mb-1.5 text-[13px] font-bold">Mouvements</h3>
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
  const { enCours, erreur, lancer } = useAction();
  return (
    <Fenetre
      titre={`${type === 'ENTREE' ? 'Entrée en stock' : 'Sortie de stock'} — ${article.libelle}`}
      sousTitre={`Stock actuel : ${article.stock} ${article.unite}.`}
      onClose={onClose}
      valider="Enregistrer"
      enCours={enCours}
      onSubmit={async () => {
        const a = await lancer(() => mouvementStock(article.id, { type, quantite: Number(quantite), motif: motif.trim() || undefined }), 'Mouvement impossible');
        if (a) onDone(a);
      }}
    >
      <Erreur message={erreur} />
      <Champ id="mv-qte" label={`Quantité (${article.unite})`}>
        <input id="mv-qte" type="number" min={1} className={SELECT_CLASS} value={quantite} onChange={(e) => setQuantite(e.target.value)} required />
      </Champ>
      <Champ id="mv-motif" label={type === 'SORTIE' ? 'Motif' : 'Motif (facultatif)'}>
        <input id="mv-motif" className={SELECT_CLASS} value={motif} onChange={(e) => setMotif(e.target.value)} required={type === 'SORTIE'} />
      </Champ>
    </Fenetre>
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
  const { enCours, erreur, lancer } = useAction();
  useEffect(() => {
    getCategories().then((c) => setCategories(c.filter((x) => x.nature === 'FOURNITURE'))).catch(() => setCategories([]));
  }, []);
  return (
    <Fenetre
      titre={article ? `Modifier ${article.libelle}` : 'Nouvel article'}
      onClose={onClose}
      valider="Enregistrer"
      enCours={enCours}
      onSubmit={async () => {
        const seuil = v.suiviStock && v.seuilAlerte !== '' ? Number(v.seuilAlerte) : null;
        const ok = await lancer(
          () =>
            article
              ? modifierArticle(article.id, { libelle: v.libelle.trim(), unite: v.unite.trim(), suiviStock: v.suiviStock, seuilAlerte: seuil, actif: v.actif })
              : creerArticle({ categorieId: v.categorieId, libelle: v.libelle.trim(), unite: v.unite.trim(), suiviStock: v.suiviStock, seuilAlerte: seuil }),
          'Enregistrement impossible',
        );
        if (ok) onDone(article ? 'Article modifié.' : 'Article créé.');
      }}
    >
      <Erreur message={erreur} />
      {!article && (
        <Champ id="ar-cat" label="Catégorie">
          <select id="ar-cat" className={SELECT_CLASS} value={v.categorieId} onChange={(e) => setV({ ...v, categorieId: e.target.value })} required>
            <option value="">Choisir…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
        </Champ>
      )}
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Champ id="ar-lib" label="Libellé">
          <input id="ar-lib" className={SELECT_CLASS} value={v.libelle} onChange={(e) => setV({ ...v, libelle: e.target.value })} minLength={2} required />
        </Champ>
        <Champ id="ar-unite" label="Unité">
          <input id="ar-unite" className={SELECT_CLASS} value={v.unite} onChange={(e) => setV({ ...v, unite: e.target.value })} required />
        </Champ>
      </div>
      <label className="mb-3 flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={v.suiviStock} onChange={(e) => setV({ ...v, suiviStock: e.target.checked })} /> Suivre le stock (entrées, sorties, alerte)
      </label>
      {v.suiviStock && (
        <Champ id="ar-seuil" label="Seuil d’alerte (facultatif)">
          <input id="ar-seuil" type="number" min={0} className={SELECT_CLASS} value={v.seuilAlerte} onChange={(e) => setV({ ...v, seuilAlerte: e.target.value })} />
        </Champ>
      )}
      {article && (
        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={v.actif} onChange={(e) => setV({ ...v, actif: e.target.checked })} /> Proposé aux demandeurs
        </label>
      )}
    </Fenetre>
  );
}
