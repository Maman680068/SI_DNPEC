'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { getDirectory } from '../../lib/api/org';
import { affecterBien, changerEtatBien, creerBien, exporterInventaire, getBien, getBiens, getCategories, modifierBien, retourBien } from '../../lib/api/logistique';
import type { DirectoryUser } from '../../lib/org/types';
import type { Bien, Categorie, EtatBien, FicheBien, TypeMouvementBien } from '../../lib/logistique/types';
import { ETAT_LABEL } from '../../lib/logistique/types';
import { ChoixUnite } from '../stages/FenetresStage';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { BTN_PRINCIPAL, BTN_SECONDAIRE, BarreOutils, CleValeur, EtatVide, SectionFenetre, Filtres, FiltreSelect, LigneTableau, Pastille, Recherche, Tableau, type TonPastille } from '../ui/Charte';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, MessageErreurChamp, Saisie, SelecteurPersonnes, ZoneTexte } from '../ui/Formulaire';
import { SqueletteListe } from '../ui/Squelette';
import { messageErreur, useToast } from '../ui/Toast';
import { jourLocal, nomDe, useEnvoi, versPersonne } from '../courrier/formulaire';
import { Panneau, dateCourte, dateHeure, nom } from './commun';

const TON: Record<EtatBien, TonPastille> = { EN_SERVICE: 'vert', EN_PANNE: 'rouge', EN_REPARATION: 'ambre', REFORME: 'gris' };
const GRILLE = 'lg:grid-cols-[150px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_120px]';
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
  const toast = useToast();
  const [liste, setListe] = useState<Bien[] | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [f, setF] = useState({ q: '', categorieId: '', etat: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<FicheBien | null>(null);
  const [creation, setCreation] = useState(false);
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
      <BarreOutils
        droite={
          <>
            <button
              type="button"
              className={BTN_SECONDAIRE}
              onClick={() =>
                exporterInventaire({ q: f.q.trim() || undefined, categorieId: f.categorieId || undefined, etat: f.etat || undefined })
                  .then(() => toast.succes('Inventaire exporté', { detail: 'Fichier Excel téléchargé.' }))
                  .catch((e) => toast.erreur('Export impossible', messageErreur(e)))
              }
            >
              <FileSpreadsheet aria-hidden size={16} />
              Exporter
            </button>
            {gestionnaire && (
              <button type="button" className={BTN_PRINCIPAL} onClick={() => setCreation(true)}>
                <Plus aria-hidden size={17} />
                Nouveau bien
              </button>
            )}
          </>
        }
      >
        <Recherche value={f.q} onChange={(q) => setF({ ...f, q })} placeholder="N°, désignation, série…" label="Rechercher un bien" />
        <Filtres actifs={[f.categorieId, f.etat].filter(Boolean).length} onEffacer={() => setF({ ...f, categorieId: '', etat: '' })}>
          <FiltreSelect label="Catégorie" value={f.categorieId} defaut="" onChange={(categorieId) => setF({ ...f, categorieId })} options={[{ value: '', label: 'Catégorie : toutes' }, ...categories.map((c) => ({ value: c.id, label: c.libelle }))]} />
          <FiltreSelect label="État" value={f.etat} defaut="" onChange={(etat) => setF({ ...f, etat })} options={[{ value: '', label: 'État : tous' }, ...(Object.keys(ETAT_LABEL) as EtatBien[]).map((e) => ({ value: e, label: ETAT_LABEL[e] }))]} />
        </Filtres>
      </BarreOutils>
      {!liste ? (
        !erreur && <SqueletteListe lignes={6} colonnes={5} />
      ) : (
        <Tableau
          label={gestionnaire ? 'Inventaire des biens' : 'Mes biens'}
          grille={GRILLE}
          colonnes={['N° d’inventaire', 'Désignation', 'Catégorie', 'Affecté à', 'État']}
          vide={<EtatVide texte={gestionnaire ? 'Aucun bien.' : 'Aucun bien affecté à vous ou à votre unité.'} />}
          pied={`${liste.length} bien${liste.length > 1 ? 's' : ''}`}
        >
          {liste.map((b) => (
            <LigneTableau key={b.id} grille={GRILLE} onClick={() => ouvrir(b.id)} testid="ligne-bien" label={`${b.numeroInventaire} — ${b.designation}`}>
              <span className="font-mono text-[12.5px] text-ink">{b.numeroInventaire}</span>
              <span className="block font-semibold">
                {b.designation}
                {b.emplacement && <span className="block text-[12px] font-normal text-text-muted">{b.emplacement}</span>}
              </span>
              <span className="block truncate text-[12.5px] text-text-muted">{b.categorie.libelle}</span>
              <span className="block truncate">{b.affectation ? b.affectation.libelle : <span className="text-text-muted">Non affecté</span>}</span>
              <Pastille ton={TON[b.etat]}>{ETAT_LABEL[b.etat]}</Pastille>
            </LigneTableau>
          ))}
        </Tableau>
      )}
      {ouvert && (
        <FicheBienPanneau
          bien={ouvert}
          onClose={() => setOuvert(null)}
          onChange={(b, m) => {
            setOuvert(b);
            toast.succes(m.titre, { detail: m.detail });
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
            toast.succes('Bien enregistré', { detail: `Numéro d’inventaire : ${b.numeroInventaire}.` });
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
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Nouveau bien"
      sousTitre="Le numéro d’inventaire est attribué automatiquement (catégorie, année, rang)."
      onClose={onClose}
      libelleValider="Enregistrer le bien"
      largeur={720}
      enCours={enCours}
      erreur={erreur}
      pied="Le bien entre à l’inventaire « En service », sans affectation."
      valider={() => (v.designation.trim().length === 1 ? { 'bi-des': 'Indiquez au moins 2 caractères.' } : {})}
      onSubmit={async () => {
        const opt = (x: string) => x.trim() || undefined;
        const r = await envoyer(() =>
          creerBien({ categorieId: v.categorieId, designation: v.designation.trim(), marque: opt(v.marque), numeroSerie: opt(v.numeroSerie), emplacement: opt(v.emplacement), dateAcquisition: opt(v.dateAcquisition) }),
        );
        if (r.ok) onCreated(r.valeur);
      }}
    >
      <Grille2>
        <Liste
          id="bi-cat"
          label="Catégorie"
          value={v.categorieId}
          onChange={(categorieId) => setV({ ...v, categorieId })}
          vide="Choisir…"
          options={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.libelle}` }))}
          required
          messageObligatoire="Choisissez la catégorie."
        />
        <Saisie id="bi-des" label="Désignation" value={v.designation} onChange={(designation) => setV({ ...v, designation })} required maxLength={300} messageObligatoire="Indiquez la désignation du bien." />
        <Saisie id="bi-marque" label="Marque" facultatif value={v.marque} onChange={(marque) => setV({ ...v, marque })} />
        <Saisie id="bi-serie" label="N° de série" facultatif value={v.numeroSerie} onChange={(numeroSerie) => setV({ ...v, numeroSerie })} />
        <Saisie id="bi-empl" label="Emplacement" facultatif value={v.emplacement} onChange={(emplacement) => setV({ ...v, emplacement })} />
        <ChampDate id="bi-date" label="Acquis le" facultatif value={v.dateAcquisition} max={jourLocal(0)} onChange={(dateAcquisition) => setV({ ...v, dateAcquisition })} />
      </Grille2>
    </FenetreFormulaire>
  );
}

type Action = 'affecter' | 'retour' | 'etat' | 'modifier' | null;

type Message = { titre: string; detail?: string };

function FicheBienPanneau({ bien: b, onClose, onChange, onSignaler }: { bien: FicheBien; onClose: () => void; onChange: (b: FicheBien, m: Message) => void; onSignaler: () => void }) {
  const [action, setAction] = useState<Action>(null);
  const fini = (nb: FicheBien, m: Message) => {
    setAction(null);
    onChange(nb, m);
  };
  if (action === 'affecter') return <FenetreAffecter bien={b} onClose={() => setAction(null)} onDone={fini} />;
  if (action === 'retour') return <FenetreMotifBien titre="Retour du bien" requis={false} valider="Enregistrer le retour" onClose={() => setAction(null)} action={(m) => retourBien(b.id, m)} onDone={(nb) => fini(nb, { titre: 'Retour enregistré', detail: `${nb.numeroInventaire} n’est plus affecté.` })} />;
  if (action === 'etat') return <FenetreEtat bien={b} onClose={() => setAction(null)} onDone={fini} />;
  if (action === 'modifier') return <FenetreModifierBien bien={b} onClose={() => setAction(null)} onDone={fini} />;
  return (
    <Panneau
      titre={`${b.numeroInventaire} — ${b.designation}`}
      filAriane={['Logistique', 'Inventaire', b.categorie.libelle]}
      sousTitre={<Pastille ton={TON[b.etat]}>{ETAT_LABEL[b.etat]}</Pastille>}
      onClose={onClose}
      testid="fiche-bien"
      cote={
        <>
          <div className="mb-[18px] grid gap-2">
            {b.droits.affecter && (
              <button type="button" className={`${BTN_PRINCIPAL} w-full`} onClick={() => setAction('affecter')}>
                {b.affectation ? 'Réaffecter' : 'Affecter'}
              </button>
            )}
            {b.droits.retour && (
              <button type="button" className={`${BTN_SECONDAIRE} w-full`} onClick={() => setAction('retour')}>
                Retour
              </button>
            )}
            {b.droits.changerEtat && (
              <button type="button" className={`${BTN_SECONDAIRE} w-full`} onClick={() => setAction('etat')}>
                Changer l’état
              </button>
            )}
            {b.droits.modifier && (
              <button type="button" className={`${BTN_SECONDAIRE} w-full`} onClick={() => setAction('modifier')}>
                Modifier
              </button>
            )}
            {b.droits.signalerPanne && (
              <button type="button" className={`${BTN_SECONDAIRE} w-full`} onClick={onSignaler}>
                Signaler une panne
              </button>
            )}
          </div>
          <SectionFenetre titre="Informations" className="">
            <CleValeur
              largeur={96}
              lignes={
                [
                  ['Affecté à', b.affectation ? `${b.affectation.libelle} (depuis le ${dateCourte(b.affectation.debut)})` : 'Personne'],
                  ['Catégorie', b.categorie.libelle],
                  b.marque ? ['Marque', b.marque] : null,
                  b.numeroSerie ? ['N° de série', b.numeroSerie] : null,
                  b.emplacement ? ['Emplacement', b.emplacement] : null,
                  b.dateAcquisition ? ['Acquis le', dateCourte(b.dateAcquisition)] : null,
                ].filter(Boolean) as [string, string][]
              }
            />
          </SectionFenetre>
        </>
      }
    >
      <SectionFenetre titre="Historique" n={b.historique.length} className="">
        <ol className="space-y-1.5 border-l-2 border-line pl-3 text-[13px]" data-testid="historique-bien">
          {b.historique.map((m) => (
            <li key={m.id}>
              <span className="text-text-muted">{dateHeure(m.createdAt)}</span> — <strong className="font-semibold">{MOUVEMENT[m.type]}</strong> {detail(m.type, m.detail)}{' '}
              <span className="text-text-muted">({nom(m.par)})</span>
            </li>
          ))}
        </ol>
      </SectionFenetre>
    </Panneau>
  );
}

function FenetreAffecter({ bien, onClose, onDone }: { bien: FicheBien; onClose: () => void; onDone: (b: FicheBien, m: Message) => void }) {
  const [mode, setMode] = useState<'personne' | 'unite'>('personne');
  const [annuaire, setAnnuaire] = useState<DirectoryUser[]>([]);
  const [personne, setPersonne] = useState('');
  const [unite, setUnite] = useState({ divisionId: null as string | null, sectionId: null as string | null, celluleId: null as string | null });
  const { enCours, erreur, envoyer } = useEnvoi();
  useEffect(() => {
    getDirectory()
      .then(setAnnuaire)
      .catch(() => setAnnuaire([]));
  }, []);
  const personnes = annuaire.map((u) => versPersonne(u));
  return (
    <FenetreFormulaire
      titre={`Affecter ${bien.numeroInventaire}`}
      sousTitre={bien.affectation ? `Actuellement : ${bien.affectation.libelle} (le retour sera enregistré).` : bien.designation}
      onClose={onClose}
      libelleValider="Affecter"
      largeur={620}
      enCours={enCours}
      erreur={erreur}
      pied="L’affectation est datée et inscrite dans l’historique du bien."
      valider={() => (mode === 'unite' && !unite.divisionId && !unite.celluleId ? { 'af-unite': 'Choisissez la division ou la cellule.' } : {})}
      onSubmit={async () => {
        const input = mode === 'personne' ? { userId: personne } : { divisionId: unite.divisionId ?? undefined, sectionId: unite.sectionId ?? undefined, celluleId: unite.celluleId ?? undefined };
        const r = await envoyer(() => affecterBien(bien.id, input));
        if (r.ok) onDone(r.valeur, { titre: 'Bien affecté', detail: `${r.valeur.numeroInventaire} → ${r.valeur.affectation?.libelle ?? nomDe(personnes, personne)}.` });
      }}
    >
      <ChoixSegment<'personne' | 'unite'>
        id="af-mode"
        label="Affecter à"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'personne', label: 'Une personne' },
          { value: 'unite', label: 'Une unité' },
        ]}
      />
      {mode === 'personne' ? (
        <SelecteurPersonnes
          id="af-personne"
          label="Personne"
          options={personnes}
          valeurs={personne ? [personne] : []}
          onChange={(ids) => setPersonne(ids[0] ?? '')}
          multiple={false}
          required
          messageObligatoire="Choisissez la personne."
        />
      ) : (
        <div id="af-unite" tabIndex={-1}>
          <ChoixUnite value={unite} onChange={setUnite} />
          <div className="-mt-2 mb-3">
            <MessageErreurChamp id="af-unite" />
          </div>
        </div>
      )}
    </FenetreFormulaire>
  );
}

function FenetreMotifBien({ titre, requis, valider, onClose, action, onDone }: { titre: string; requis: boolean; valider: string; onClose: () => void; action: (m: string) => Promise<FicheBien>; onDone: (b: FicheBien) => void }) {
  const [motif, setMotif] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={titre}
      onClose={onClose}
      libelleValider={valider}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      pied="Inscrit dans l’historique du bien."
      onSubmit={async () => {
        const r = await envoyer(() => action(motif.trim()));
        if (r.ok) onDone(r.valeur);
      }}
    >
      <ZoneTexte id="bi-motif" label="Motif" facultatif={!requis} value={motif} onChange={setMotif} required={requis} />
    </FenetreFormulaire>
  );
}

function FenetreEtat({ bien, onClose, onDone }: { bien: FicheBien; onClose: () => void; onDone: (b: FicheBien, m: Message) => void }) {
  const [etat, setEtat] = useState<EtatBien>(bien.etat === 'EN_SERVICE' ? 'EN_PANNE' : 'EN_SERVICE');
  const [motif, setMotif] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const reforme = etat === 'REFORME';
  return (
    <FenetreFormulaire
      titre={`État de ${bien.numeroInventaire}`}
      sousTitre={`Actuellement : ${ETAT_LABEL[bien.etat]}.`}
      onClose={onClose}
      libelleValider={reforme ? 'Réformer définitivement' : 'Enregistrer'}
      danger={reforme}
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      pied={reforme ? 'La réforme est définitive : le bien garde son numéro, sort du parc, et son affectation est close.' : 'Le changement est inscrit dans l’historique du bien.'}
      onSubmit={async () => {
        const r = await envoyer(() => changerEtatBien(bien.id, etat, motif.trim()));
        if (r.ok) onDone(r.valeur, { titre: reforme ? 'Bien réformé' : 'État enregistré', detail: `${r.valeur.numeroInventaire} : ${ETAT_LABEL[r.valeur.etat]}.` });
      }}
    >
      <ChoixSegment<EtatBien>
        id="bi-etat"
        label="Nouvel état"
        value={etat}
        onChange={setEtat}
        options={(Object.keys(ETAT_LABEL) as EtatBien[]).filter((e) => e !== bien.etat).map((e) => ({ value: e, label: ETAT_LABEL[e] }))}
      />
      <ZoneTexte id="bi-etat-motif" label="Motif" facultatif={!reforme} value={motif} onChange={setMotif} required={reforme} messageObligatoire="Indiquez le motif de la réforme." />
    </FenetreFormulaire>
  );
}

function FenetreModifierBien({ bien, onClose, onDone }: { bien: FicheBien; onClose: () => void; onDone: (b: FicheBien, m: Message) => void }) {
  const [v, setV] = useState({ designation: bien.designation, marque: bien.marque ?? '', numeroSerie: bien.numeroSerie ?? '', emplacement: bien.emplacement ?? '' });
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre={`Modifier ${bien.numeroInventaire}`}
      sousTitre="Le numéro d’inventaire et la catégorie ne changent jamais."
      onClose={onClose}
      libelleValider="Enregistrer"
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      pied="La modification est inscrite dans l’historique du bien."
      valider={() => (v.designation.trim().length === 1 ? { 'bm-des': 'Indiquez au moins 2 caractères.' } : {})}
      onSubmit={async () => {
        const changes: Record<string, string | null> = {};
        if (v.designation.trim() !== bien.designation) changes.designation = v.designation.trim();
        for (const k of ['marque', 'numeroSerie', 'emplacement'] as const) if ((v[k].trim() || null) !== bien[k]) changes[k] = v[k].trim() || null;
        if (Object.keys(changes).length === 0) return onClose();
        const r = await envoyer(() => modifierBien(bien.id, changes));
        if (r.ok) onDone(r.valeur, { titre: 'Bien modifié', detail: r.valeur.numeroInventaire });
      }}
    >
      <Saisie id="bm-des" label="Désignation" value={v.designation} onChange={(designation) => setV({ ...v, designation })} required maxLength={300} />
      <Grille2>
        <Saisie id="bm-marque" label="Marque" facultatif value={v.marque} onChange={(marque) => setV({ ...v, marque })} />
        <Saisie id="bm-serie" label="N° de série" facultatif value={v.numeroSerie} onChange={(numeroSerie) => setV({ ...v, numeroSerie })} />
      </Grille2>
      <Saisie id="bm-empl" label="Emplacement" facultatif value={v.emplacement} onChange={(emplacement) => setV({ ...v, emplacement })} />
    </FenetreFormulaire>
  );
}
