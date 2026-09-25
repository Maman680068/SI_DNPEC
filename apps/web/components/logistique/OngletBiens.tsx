'use client';

import { useCallback, useEffect, useState } from 'react';
import { searchUsers } from '../../lib/api/org';
import { affecterBien, changerEtatBien, creerBien, exporterInventaire, getBien, getBiens, getCategories, modifierBien, retourBien } from '../../lib/api/logistique';
import type { BasicUserInfo } from '../../lib/org/types';
import type { Bien, Categorie, EtatBien, FicheBien, TypeMouvementBien } from '../../lib/logistique/types';
import { ETAT_LABEL } from '../../lib/logistique/types';
import { Erreur, Fenetre, SELECT_CLASS, TEXTAREA_CLASS } from '../courrier/ui';
import { ChoixUnite } from '../stages/FenetresStage';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Champ, Info, Panneau, Vide, dateCourte, dateHeure, nom, useAction } from './commun';

const TON: Record<EtatBien, 'sage' | 'clay' | 'gold' | 'muted'> = { EN_SERVICE: 'sage', EN_PANNE: 'clay', EN_REPARATION: 'gold', REFORME: 'muted' };
const MOUVEMENT: Record<TypeMouvementBien, string> = {
  ACQUISITION: 'Entrée à l’inventaire',
  AFFECTATION: 'Affectation',
  RETOUR: 'Retour',
  CHANGEMENT_ETAT: 'Changement d’état',
  MODIFICATION: 'Modification',
  INTERVENTION: 'Intervention',
};
const EVENEMENT: Record<string, string> = { demandee: 'demandée', traitee: 'traitée', refusee: 'refusée', annulee: 'annulée' };

function detail(type: TypeMouvementBien, d: Record<string, unknown>): string {
  const s = (k: string) => (d[k] === null || d[k] === undefined ? '' : String(d[k]));
  switch (type) {
    case 'AFFECTATION':
      return `à ${s('a')}`;
    case 'RETOUR':
      return `de ${s('de')}${s('motif') ? ` — ${s('motif')}` : ''}`;
    case 'CHANGEMENT_ETAT':
      return `${ETAT_LABEL[s('de') as EtatBien] ?? s('de')} → ${ETAT_LABEL[s('a') as EtatBien] ?? s('a')}${s('motif') ? ` — ${s('motif')}` : ''}`;
    case 'INTERVENTION':
      return `${EVENEMENT[s('event')] ?? s('event')}${s('objet') ? ` : ${s('objet')}` : ''}${s('detail') ? ` — ${s('detail')}` : ''}`;
    case 'MODIFICATION':
      return Object.keys((d.apres as Record<string, unknown>) ?? {}).join(', ');
    default:
      return s('designation');
  }
}

export function OngletBiens({ gestionnaire, ouvrirId, onSignaler }: { gestionnaire: boolean; ouvrirId: string | null; onSignaler: (b: Bien) => void }) {
  const [liste, setListe] = useState<Bien[] | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [f, setF] = useState({ q: '', categorieId: '', etat: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<FicheBien | null>(null);
  const [creation, setCreation] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const charger = useCallback(() => {
    getBiens({ q: f.q.trim() || undefined, categorieId: f.categorieId || undefined, etat: f.etat || undefined })
      .then(setListe)
      .catch((e) => setErreur(messageChargement(e)));
  }, [f]);
  useEffect(() => {
    const t = setTimeout(charger, 200);
    return () => clearTimeout(t);
  }, [charger]);
  useEffect(() => {
    getCategories().then((c) => setCategories(c.filter((x) => x.nature === 'BIEN'))).catch(() => setCategories([]));
  }, []);
  const ouvrir = useCallback((id: string) => {
    getBien(id).then(setOuvert).catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(() => {
    if (ouvrirId) ouvrir(ouvrirId);
  }, [ouvrirId, ouvrir]);

  return (
    <div data-testid="onglet-biens">
      <ErreurChargement message={erreur} />
      <Info message={info} />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <input aria-label="Rechercher un bien" placeholder="N°, désignation, série…" className={`${SELECT_CLASS} !w-56`} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <select aria-label="Catégorie" className={`${SELECT_CLASS} !w-auto`} value={f.categorieId} onChange={(e) => setF({ ...f, categorieId: e.target.value })}>
            <option value="">Toutes catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
          <select aria-label="État" className={`${SELECT_CLASS} !w-auto`} value={f.etat} onChange={(e) => setF({ ...f, etat: e.target.value })}>
            <option value="">Tous états</option>
            {(Object.keys(ETAT_LABEL) as EtatBien[]).map((e) => (
              <option key={e} value={e}>
                {ETAT_LABEL[e]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void exporterInventaire({ q: f.q.trim() || undefined, categorieId: f.categorieId || undefined, etat: f.etat || undefined })}>Exporter</Button>
          {gestionnaire && (
            <Button variant="gold" onClick={() => setCreation(true)}>
              + Nouveau bien
            </Button>
          )}
        </div>
      </div>
      {!liste ? null : liste.length === 0 ? (
        <Vide>{gestionnaire ? 'Aucun bien.' : 'Aucun bien affecté à vous ou à votre unité.'}</Vide>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {liste.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => ouvrir(b.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bg" data-testid="ligne-bien">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">
                    <span className="font-mono text-[12.5px]">{b.numeroInventaire}</span> — {b.designation}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    {b.categorie.libelle}
                    {b.affectation ? ` · ${b.affectation.libelle}` : ' · non affecté'}
                    {b.emplacement ? ` · ${b.emplacement}` : ''}
                  </div>
                </div>
                <Badge tone={TON[b.etat]}>{ETAT_LABEL[b.etat]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ouvert && (
        <FicheBienPanneau
          bien={ouvert}
          onClose={() => setOuvert(null)}
          onChange={(b, m) => {
            setOuvert(b);
            setInfo(m);
            charger();
          }}
          onSignaler={() => {
            setOuvert(null);
            onSignaler(ouvert);
          }}
        />
      )}
      {creation && (
        <FenetreNouveauBien
          categories={categories}
          onClose={() => setCreation(false)}
          onCreated={(b) => {
            setCreation(false);
            setInfo(`Bien enregistré sous le numéro ${b.numeroInventaire}.`);
            setOuvert(b);
            charger();
          }}
        />
      )}
    </div>
  );
}

function FenetreNouveauBien({ categories, onClose, onCreated }: { categories: Categorie[]; onClose: () => void; onCreated: (b: FicheBien) => void }) {
  const [v, setV] = useState({ categorieId: '', designation: '', marque: '', numeroSerie: '', emplacement: '', dateAcquisition: '' });
  const { enCours, erreur, lancer } = useAction();
  return (
    <Fenetre
      titre="Nouveau bien"
      sousTitre="Le numéro d’inventaire est attribué automatiquement (catégorie, année, rang)."
      onClose={onClose}
      valider="Enregistrer"
      enCours={enCours}
      onSubmit={async () => {
        const opt = (x: string) => x.trim() || undefined;
        const b = await lancer(
          () => creerBien({ categorieId: v.categorieId, designation: v.designation.trim(), marque: opt(v.marque), numeroSerie: opt(v.numeroSerie), emplacement: opt(v.emplacement), dateAcquisition: opt(v.dateAcquisition) }),
          'Enregistrement impossible',
        );
        if (b) onCreated(b);
      }}
    >
      <Erreur message={erreur} />
      <Champ id="bi-cat" label="Catégorie">
        <select id="bi-cat" className={SELECT_CLASS} value={v.categorieId} onChange={(e) => setV({ ...v, categorieId: e.target.value })} required>
          <option value="">Choisir…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.libelle}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="bi-des" label="Désignation">
        <input id="bi-des" className={SELECT_CLASS} value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })} minLength={2} required />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ id="bi-marque" label="Marque">
          <input id="bi-marque" className={SELECT_CLASS} value={v.marque} onChange={(e) => setV({ ...v, marque: e.target.value })} />
        </Champ>
        <Champ id="bi-serie" label="N° de série">
          <input id="bi-serie" className={SELECT_CLASS} value={v.numeroSerie} onChange={(e) => setV({ ...v, numeroSerie: e.target.value })} />
        </Champ>
        <Champ id="bi-empl" label="Emplacement">
          <input id="bi-empl" className={SELECT_CLASS} value={v.emplacement} onChange={(e) => setV({ ...v, emplacement: e.target.value })} />
        </Champ>
        <Champ id="bi-date" label="Acquis le">
          <input id="bi-date" type="date" className={SELECT_CLASS} value={v.dateAcquisition} onChange={(e) => setV({ ...v, dateAcquisition: e.target.value })} />
        </Champ>
      </div>
    </Fenetre>
  );
}

type Action = 'affecter' | 'retour' | 'etat' | 'modifier' | null;

function FicheBienPanneau({ bien: b, onClose, onChange, onSignaler }: { bien: FicheBien; onClose: () => void; onChange: (b: FicheBien, m: string) => void; onSignaler: () => void }) {
  const [action, setAction] = useState<Action>(null);
  const fini = (nb: FicheBien, m: string) => {
    setAction(null);
    onChange(nb, m);
  };
  if (action === 'affecter') return <FenetreAffecter bien={b} onClose={() => setAction(null)} onDone={fini} />;
  if (action === 'retour') return <FenetreMotifBien titre="Retour du bien" requis={false} valider="Enregistrer le retour" onClose={() => setAction(null)} action={(m) => retourBien(b.id, m)} onDone={(nb) => fini(nb, 'Retour enregistré.')} />;
  if (action === 'etat') return <FenetreEtat bien={b} onClose={() => setAction(null)} onDone={fini} />;
  if (action === 'modifier') return <FenetreModifierBien bien={b} onClose={() => setAction(null)} onDone={fini} />;
  return (
    <Panneau titre={`${b.numeroInventaire} — ${b.designation}`} sousTitre={`${b.categorie.libelle} · ${ETAT_LABEL[b.etat]}`} onClose={onClose} testid="fiche-bien">
      <dl className="mb-3 grid grid-cols-[120px_1fr] gap-y-1 text-[13px]">
        <dt className="text-text-muted">Affecté à</dt>
        <dd>{b.affectation ? `${b.affectation.libelle} (depuis le ${dateCourte(b.affectation.debut)})` : 'Personne'}</dd>
        {b.marque && (
          <>
            <dt className="text-text-muted">Marque</dt>
            <dd>{b.marque}</dd>
          </>
        )}
        {b.numeroSerie && (
          <>
            <dt className="text-text-muted">N° de série</dt>
            <dd>{b.numeroSerie}</dd>
          </>
        )}
        {b.emplacement && (
          <>
            <dt className="text-text-muted">Emplacement</dt>
            <dd>{b.emplacement}</dd>
          </>
        )}
        {b.dateAcquisition && (
          <>
            <dt className="text-text-muted">Acquis le</dt>
            <dd>{dateCourte(b.dateAcquisition)}</dd>
          </>
        )}
      </dl>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {b.droits.signalerPanne && <Button onClick={onSignaler}>Signaler une panne</Button>}
        {b.droits.modifier && <Button onClick={() => setAction('modifier')}>Modifier</Button>}
        {b.droits.changerEtat && <Button onClick={() => setAction('etat')}>Changer l’état</Button>}
        {b.droits.retour && <Button onClick={() => setAction('retour')}>Retour</Button>}
        {b.droits.affecter && (
          <Button variant="gold" onClick={() => setAction('affecter')}>
            {b.affectation ? 'Réaffecter' : 'Affecter'}
          </Button>
        )}
      </div>
      <h3 className="mb-1.5 text-[13px] font-bold">Historique</h3>
      <ol className="border-l-2 border-line pl-3 text-[12.5px]" data-testid="historique-bien">
        {b.historique.map((m) => (
          <li key={m.id} className="mb-1">
            <span className="text-text-muted">{dateHeure(m.createdAt)}</span> — <strong>{MOUVEMENT[m.type]}</strong> {detail(m.type, m.detail)}{' '}
            <span className="text-text-faint">({nom(m.par)})</span>
          </li>
        ))}
      </ol>
    </Panneau>
  );
}

function FenetreAffecter({ bien, onClose, onDone }: { bien: FicheBien; onClose: () => void; onDone: (b: FicheBien, m: string) => void }) {
  const [mode, setMode] = useState<'personne' | 'unite'>('personne');
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<BasicUserInfo[]>([]);
  const [personne, setPersonne] = useState<BasicUserInfo | null>(null);
  const [unite, setUnite] = useState({ divisionId: null as string | null, sectionId: null as string | null, celluleId: null as string | null });
  const { enCours, erreur, lancer } = useAction();
  useEffect(() => {
    if (!q.trim() || personne) return setResultats([]);
    const t = setTimeout(() => searchUsers(q).then(setResultats).catch(() => setResultats([])), 200);
    return () => clearTimeout(t);
  }, [q, personne]);
  return (
    <Fenetre
      titre={`Affecter ${bien.numeroInventaire}`}
      sousTitre={bien.affectation ? `Actuellement : ${bien.affectation.libelle} (le retour sera enregistré).` : undefined}
      onClose={onClose}
      valider="Affecter"
      enCours={enCours}
      onSubmit={async () => {
        const input = mode === 'personne' ? { userId: personne?.id } : { divisionId: unite.divisionId ?? undefined, sectionId: unite.sectionId ?? undefined, celluleId: unite.celluleId ?? undefined };
        const b = await lancer(() => affecterBien(bien.id, input), 'Affectation impossible');
        if (b) onDone(b, `Bien affecté à ${b.affectation?.libelle ?? ''}.`);
      }}
    >
      <Erreur message={erreur} />
      <div className="mb-3 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            ['personne', 'Une personne'],
            ['unite', 'Une unité'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold ${mode === k ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'personne' ? (
        <Champ id="af-personne" label="Personne">
          {personne ? (
            <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-[13px]">
              {nom(personne)}
              <button type="button" className="text-accent underline" onClick={() => { setPersonne(null); setQ(''); }}>
                Changer
              </button>
            </div>
          ) : (
            <div className="relative">
              <input id="af-personne" className={SELECT_CLASS} placeholder="Nom de la personne…" value={q} onChange={(e) => setQ(e.target.value)} required />
              {resultats.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[180px] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg">
                  {resultats.map((u) => (
                    <button key={u.id} type="button" onClick={() => setPersonne(u)} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-bg">
                      {nom(u)}
                      {u.jobTitle && <span className="ml-1.5 text-text-faint">· {u.jobTitle}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Champ>
      ) : (
        <ChoixUnite value={unite} onChange={setUnite} />
      )}
    </Fenetre>
  );
}

function FenetreMotifBien({ titre, requis, valider, onClose, action, onDone }: { titre: string; requis: boolean; valider: string; onClose: () => void; action: (m: string) => Promise<FicheBien>; onDone: (b: FicheBien) => void }) {
  const [motif, setMotif] = useState('');
  const { enCours, erreur, lancer } = useAction();
  return (
    <Fenetre titre={titre} onClose={onClose} valider={valider} enCours={enCours} onSubmit={async () => { const b = await lancer(() => action(motif.trim()), 'Action impossible'); if (b) onDone(b); }}>
      <Erreur message={erreur} />
      <Champ id="bi-motif" label={requis ? 'Motif' : 'Motif (facultatif)'}>
        <textarea id="bi-motif" className={TEXTAREA_CLASS} value={motif} onChange={(e) => setMotif(e.target.value)} required={requis} />
      </Champ>
    </Fenetre>
  );
}

function FenetreEtat({ bien, onClose, onDone }: { bien: FicheBien; onClose: () => void; onDone: (b: FicheBien, m: string) => void }) {
  const [etat, setEtat] = useState<EtatBien>(bien.etat === 'EN_SERVICE' ? 'EN_PANNE' : 'EN_SERVICE');
  const [motif, setMotif] = useState('');
  const { enCours, erreur, lancer } = useAction();
  return (
    <Fenetre
      titre={`État de ${bien.numeroInventaire}`}
      onClose={onClose}
      valider={etat === 'REFORME' ? 'Réformer définitivement' : 'Enregistrer'}
      danger={etat === 'REFORME'}
      enCours={enCours}
      onSubmit={async () => {
        const b = await lancer(() => changerEtatBien(bien.id, etat, motif.trim()), 'Changement impossible');
        if (b) onDone(b, `État : ${ETAT_LABEL[b.etat]}.`);
      }}
    >
      <Erreur message={erreur} />
      <Champ id="bi-etat" label="Nouvel état">
        <select id="bi-etat" className={SELECT_CLASS} value={etat} onChange={(e) => setEtat(e.target.value as EtatBien)}>
          {(Object.keys(ETAT_LABEL) as EtatBien[])
            .filter((e) => e !== bien.etat)
            .map((e) => (
              <option key={e} value={e}>
                {ETAT_LABEL[e]}
              </option>
            ))}
        </select>
      </Champ>
      {etat === 'REFORME' && <p className="mb-3 text-[12.5px] text-clay">La réforme est définitive : le bien garde son numéro, sort du parc, et son affectation est close.</p>}
      <Champ id="bi-etat-motif" label={etat === 'REFORME' ? 'Motif' : 'Motif (facultatif)'}>
        <textarea id="bi-etat-motif" className={TEXTAREA_CLASS} value={motif} onChange={(e) => setMotif(e.target.value)} required={etat === 'REFORME'} />
      </Champ>
    </Fenetre>
  );
}

function FenetreModifierBien({ bien, onClose, onDone }: { bien: FicheBien; onClose: () => void; onDone: (b: FicheBien, m: string) => void }) {
  const [v, setV] = useState({ designation: bien.designation, marque: bien.marque ?? '', numeroSerie: bien.numeroSerie ?? '', emplacement: bien.emplacement ?? '' });
  const { enCours, erreur, lancer } = useAction();
  return (
    <Fenetre
      titre={`Modifier ${bien.numeroInventaire}`}
      sousTitre="Le numéro d’inventaire et la catégorie ne changent jamais."
      onClose={onClose}
      valider="Enregistrer"
      enCours={enCours}
      onSubmit={async () => {
        const changes: Record<string, string | null> = {};
        if (v.designation.trim() !== bien.designation) changes.designation = v.designation.trim();
        for (const k of ['marque', 'numeroSerie', 'emplacement'] as const) if ((v[k].trim() || null) !== bien[k]) changes[k] = v[k].trim() || null;
        const b = await lancer(() => modifierBien(bien.id, changes), 'Modification impossible');
        if (b) onDone(b, 'Bien modifié.');
      }}
    >
      <Erreur message={erreur} />
      <Champ id="bm-des" label="Désignation">
        <input id="bm-des" className={SELECT_CLASS} value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })} minLength={2} required />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ id="bm-marque" label="Marque">
          <input id="bm-marque" className={SELECT_CLASS} value={v.marque} onChange={(e) => setV({ ...v, marque: e.target.value })} />
        </Champ>
        <Champ id="bm-serie" label="N° de série">
          <input id="bm-serie" className={SELECT_CLASS} value={v.numeroSerie} onChange={(e) => setV({ ...v, numeroSerie: e.target.value })} />
        </Champ>
      </div>
      <Champ id="bm-empl" label="Emplacement">
        <input id="bm-empl" className={SELECT_CLASS} value={v.emplacement} onChange={(e) => setV({ ...v, emplacement: e.target.value })} />
      </Champ>
    </Fenetre>
  );
}
