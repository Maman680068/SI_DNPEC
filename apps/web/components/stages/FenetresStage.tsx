'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import {
  accepterPeriode,
  ajouterPeriode,
  changerTuteur,
  creerActeAttestation,
  creerStage,
  designerEncadrant,
  getEncadrantsPossibles,
  getRegistresAttestation,
  getStagiairesDisponibles,
  getTuteursPossibles,
  modifierPeriode,
  modifierStage,
} from '../../lib/api/stages';
import type { Candidat, FormatEvaluation, Periode, Personne, Stage } from '../../lib/stages/types';
import { FORMAT_LABEL } from '../../lib/stages/types';
import { SELECT_CLASS } from '../courrier/ui';
import { ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, MessageErreurChamp, Saisie, SelecteurPersonnes, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

const jourIso = (d: string) => d.slice(0, 10);

/** Exécute une action et affiche le refus de l'API en bas de la fenêtre. */
function useAction(onDone: (s?: Stage) => void) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function lancer(fn: () => Promise<unknown>, defaut: string) {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fn();
      onDone(r && typeof r === 'object' && 'periodes' in r ? (r as Stage) : undefined);
    } catch (err) {
      setErreur(messageErreur(err, defaut));
    } finally {
      setEnCours(false);
    }
  }
  return { enCours, erreur, lancer };
}

const nomComplet = (p: Personne) => `${p.firstName} ${p.lastName}`;
/** Règle de la fenêtre : la fin ne précède pas le début. */
const finApresDebut = (debut: string, fin: string, idFin: string) => (debut && fin && fin < debut ? { [idFin]: 'La fin ne peut pas précéder le début.' } : {});
const motifValide = (motif: string, id: string) => (motif.trim() && motif.trim().length < 5 ? { [id]: 'Le motif doit compter au moins 5 caractères.' } : {});

// ---------------------------------------------------------------- stage

export function FenetreNouveauStage({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Stage) => void }) {
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [v, setV] = useState({ stagiaireId: '', etablissement: '', diplomePrepare: '', encadrantAcademique: '', dateDebut: '', dateFin: '' });
  const { enCours, erreur, lancer } = useAction((s) => s && onCreated(s));
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  useEffect(() => {
    getStagiairesDisponibles()
      .then(setCandidats)
      .catch((e) => setErreurListe(messageErreur(e, 'Impossible de charger les stagiaires')));
  }, []);
  return (
    <FenetreFormulaire
      titre="Nouveau stage"
      sousTitre="Le compte du stagiaire est créé auparavant (administrateur, ou import Excel avec le rôle Stagiaire)."
      onClose={onClose}
      onSubmit={() =>
        lancer(
          () =>
            creerStage({
              ...v,
              etablissement: v.etablissement.trim(),
              diplomePrepare: v.diplomePrepare.trim() || undefined,
              encadrantAcademique: v.encadrantAcademique.trim() || undefined,
            }),
          'Création impossible',
        )
      }
      valider={() => ({
        ...finApresDebut(v.dateDebut, v.dateFin, 'ns-fin'),
        ...(v.etablissement.trim() && v.etablissement.trim().length < 2 ? { 'ns-etab': 'Le nom est trop court.' } : {}),
      })}
      libelleValider="Créer le stage"
      enCours={enCours}
      erreur={erreurListe ?? erreur}
      pied="Vous ajoutez ensuite les périodes : chaque unité d’accueil accepte la sienne et désigne le tuteur."
    >
      <SelecteurPersonnes
        id="ns-stagiaire"
        label="Stagiaire"
        multiple={false}
        required
        messageObligatoire="Choisissez le stagiaire."
        placeholder={candidats ? (candidats.length ? 'Rechercher un stagiaire…' : 'Aucun compte stagiaire disponible') : 'Chargement des stagiaires…'}
        options={(candidats ?? []).map((c) => ({ id: c.id, nom: nomComplet(c), detail: c.email }))}
        valeurs={v.stagiaireId ? [v.stagiaireId] : []}
        onChange={(ids) => set('stagiaireId')(ids[0] ?? '')}
      />
      <Saisie id="ns-etab" label="Établissement d’origine" value={v.etablissement} onChange={set('etablissement')} required maxLength={200} />
      <Grille2>
        <Saisie id="ns-diplome" label="Diplôme préparé" facultatif value={v.diplomePrepare} onChange={set('diplomePrepare')} maxLength={200} />
        <Saisie id="ns-encadrant" label="Encadrant académique" facultatif value={v.encadrantAcademique} onChange={set('encadrantAcademique')} maxLength={200} />
        <ChampDate id="ns-debut" label="Début" value={v.dateDebut} onChange={set('dateDebut')} required />
        <ChampDate id="ns-fin" label="Fin" value={v.dateFin} onChange={set('dateFin')} required />
      </Grille2>
    </FenetreFormulaire>
  );
}

export function FenetreModifierStage({ stage, onClose, onDone }: { stage: Stage; onClose: () => void; onDone: (s?: Stage) => void }) {
  const [v, setV] = useState({
    etablissement: stage.etablissement,
    diplomePrepare: stage.diplomePrepare ?? '',
    encadrantAcademique: stage.encadrantAcademique ?? '',
    dateDebut: jourIso(stage.dateDebut),
    dateFin: jourIso(stage.dateFin),
  });
  const { enCours, erreur, lancer } = useAction(onDone);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  return (
    <FenetreFormulaire
      titre="Modifier le stage"
      sousTitre={nomComplet(stage.stagiaire)}
      onClose={onClose}
      onSubmit={() =>
        lancer(
          () =>
            modifierStage(stage.id, {
              etablissement: v.etablissement.trim(),
              diplomePrepare: v.diplomePrepare.trim() || undefined,
              encadrantAcademique: v.encadrantAcademique.trim() || undefined,
              dateDebut: v.dateDebut,
              dateFin: v.dateFin,
            }),
          'Modification impossible',
        )
      }
      valider={() => finApresDebut(v.dateDebut, v.dateFin, 'ms-fin')}
      libelleValider="Enregistrer"
      enCours={enCours}
      erreur={erreur}
      pied="Les dates des périodes doivent rester comprises dans celles du stage."
    >
      <Saisie id="ms-etab" label="Établissement d’origine" value={v.etablissement} onChange={set('etablissement')} required />
      <Grille2>
        <Saisie id="ms-diplome" label="Diplôme préparé" facultatif value={v.diplomePrepare} onChange={set('diplomePrepare')} />
        <Saisie id="ms-encadrant" label="Encadrant académique" facultatif value={v.encadrantAcademique} onChange={set('encadrantAcademique')} />
        <ChampDate id="ms-debut" label="Début" value={v.dateDebut} onChange={set('dateDebut')} required />
        <ChampDate id="ms-fin" label="Fin" value={v.dateFin} onChange={set('dateFin')} required />
      </Grille2>
    </FenetreFormulaire>
  );
}

// -------------------------------------------------------------- période

/** Choix de l'unité d'accueil : Division (section facultative) ou Cellule,
 * unités actives seulement (l'API refuse une unité suspendue). */
export function ChoixUnite({
  value,
  onChange,
  id,
}: {
  value: { divisionId: string | null; sectionId: string | null; celluleId: string | null };
  onChange: (v: { divisionId: string | null; sectionId: string | null; celluleId: string | null }) => void;
  /** Dans une fenêtre de formulaire : identifiants des listes, pour le message « obligatoire » sous le champ. */
  id?: string;
}) {
  const { divisions, sections, cellules } = useOrg();
  const [mode, setMode] = useState<'division' | 'cellule'>(value.celluleId ? 'cellule' : 'division');
  const vide = { divisionId: null, sectionId: null, celluleId: null };
  return (
    <div className="mb-3.5">
      <div className="mb-2 flex gap-0.5 rounded-md border border-line bg-bg p-0.5" style={{ width: 'fit-content' }}>
        {(
          [
            ['division', 'Division'],
            ['cellule', 'Cellule'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            onClick={() => {
              setMode(k);
              onChange(vide);
            }}
            className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold ${mode === k ? 'bg-surface text-ink shadow-sm' : 'text-text-muted'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {mode === 'division' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <select id={id ? `${id}-division` : undefined} aria-label="Division" data-message-obligatoire={id ? 'Choisissez la division d’accueil.' : undefined} className={SELECT_CLASS} value={value.divisionId ?? ''} onChange={(e) => onChange({ ...vide, divisionId: e.target.value || null })} required>
            <option value="">Division…</option>
            {divisions.filter((d) => d.isActive).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Section"
            className={SELECT_CLASS}
            value={value.sectionId ?? ''}
            onChange={(e) => onChange({ ...value, sectionId: e.target.value || null })}
            disabled={!value.divisionId}
          >
            <option value="">Toute la division</option>
            {sections.filter((s) => s.isActive && s.divisionId === value.divisionId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <select id={id ? `${id}-cellule` : undefined} aria-label="Cellule" data-message-obligatoire={id ? 'Choisissez la cellule d’accueil.' : undefined} className={SELECT_CLASS} value={value.celluleId ?? ''} onChange={(e) => onChange({ ...vide, celluleId: e.target.value || null })} required>
          <option value="">Cellule…</option>
          {cellules.filter((c) => c.isActive).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {id && <MessageErreurChamp id={`${id}-${mode}`} />}
    </div>
  );
}

export function FenetrePeriode({ stage, periode, onClose, onDone }: { stage: Stage; periode?: Periode; onClose: () => void; onDone: (s?: Stage) => void }) {
  const commencee = periode?.statut === 'EN_COURS';
  const [unite, setUnite] = useState({ divisionId: periode?.divisionId ?? null, sectionId: periode?.sectionId ?? null, celluleId: periode?.celluleId ?? null });
  const [v, setV] = useState({
    dateDebut: periode ? jourIso(periode.dateDebut) : '',
    dateFin: periode ? jourIso(periode.dateFin) : '',
    formatEvaluation: (periode?.formatEvaluation ?? 'GRILLE') as FormatEvaluation,
    objectifs: periode?.objectifs ?? '',
    motif: '',
  });
  const { enCours, erreur, lancer } = useAction(onDone);
  const set = (k: 'dateDebut' | 'dateFin' | 'objectifs' | 'motif') => (x: string) => setV((o) => ({ ...o, [k]: x }));
  function valider() {
    if (periode && commencee) return lancer(() => modifierPeriode(stage.id, periode.id, { dateFin: v.dateFin, motif: v.motif.trim() }), 'Modification impossible');
    const input = { ...unite, dateDebut: v.dateDebut, dateFin: v.dateFin, formatEvaluation: v.formatEvaluation, objectifs: v.objectifs.trim() };
    return lancer(() => (periode ? modifierPeriode(stage.id, periode.id, input) : ajouterPeriode(stage.id, input)), 'Enregistrement impossible');
  }
  const min = jourIso(stage.dateDebut);
  const max = jourIso(stage.dateFin);
  return (
    <FenetreFormulaire
      titre={periode ? 'Modifier la période' : 'Ajouter une période'}
      sousTitre={commencee ? 'Période en cours : seule la date de fin se modifie, avec un motif.' : `${nomComplet(stage.stagiaire)} · stage du ${new Date(stage.dateDebut).toLocaleDateString('fr-FR', { timeZone: 'UTC' })} au ${new Date(stage.dateFin).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`}
      onClose={onClose}
      onSubmit={valider}
      valider={() => ({ ...(!commencee ? finApresDebut(v.dateDebut, v.dateFin, 'pe-fin') : {}), ...(commencee ? motifValide(v.motif, 'pe-motif') : {}) })}
      libelleValider="Enregistrer"
      enCours={enCours}
      erreur={erreur}
      pied={commencee ? 'Le tuteur et l’unité d’accueil sont prévenus.' : 'La capacité d’accueil de l’unité est vérifiée ; l’unité accepte ensuite la période et désigne le tuteur.'}
    >
      {!commencee && (
        <>
          <p className="mb-1.5 block text-[13px] font-semibold text-text">Unité d’accueil</p>
          <ChoixUnite id="pe-unite" value={unite} onChange={setUnite} />
        </>
      )}
      <Grille2>
        {!commencee && <ChampDate id="pe-debut" label="Du" value={v.dateDebut} min={min} max={max} onChange={set('dateDebut')} required raccourcis={false} />}
        <ChampDate id="pe-fin" label="Au" value={v.dateFin} min={min} max={max} onChange={set('dateFin')} required raccourcis={false} />
      </Grille2>
      {!commencee && (
        <>
          <ChoixSegment<FormatEvaluation>
            id="pe-format"
            label="Évaluation de fin de période"
            options={(Object.keys(FORMAT_LABEL) as FormatEvaluation[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
            value={v.formatEvaluation}
            onChange={(f) => setV((o) => ({ ...o, formatEvaluation: f }))}
          />
          <ZoneTexte id="pe-obj" label="Objectifs" facultatif value={v.objectifs} onChange={set('objectifs')} maxLength={2000} />
        </>
      )}
      {commencee && <ZoneTexte id="pe-motif" label="Motif" value={v.motif} onChange={set('motif')} required />}
    </FenetreFormulaire>
  );
}

/** Acceptation (tuteur à désigner) ou changement de tuteur : la liste est
 * celle que l'API accepterait (GET …/tuteurs-possibles). */
export function FenetreTuteur({ stage, periode, mode, onClose, onDone }: { stage: Stage; periode: Periode; mode: 'accepter' | 'changer'; onClose: () => void; onDone: (s?: Stage) => void }) {
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [tuteurId, setTuteurId] = useState(periode.tuteur?.id ?? '');
  const { enCours, erreur, lancer } = useAction(onDone);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  useEffect(() => {
    getTuteursPossibles(stage.id, periode.id)
      .then(setCandidats)
      .catch((e) => setErreurListe(messageErreur(e, 'Impossible de charger les tuteurs possibles')));
  }, [stage.id, periode.id]);
  // Le tuteur actuel reste affiché même s'il n'est plus proposé.
  const options = (candidats ?? []).map((c) => ({ id: c.id, nom: nomComplet(c), detail: c.jobTitle ?? null }));
  if (periode.tuteur && !options.some((o) => o.id === periode.tuteur!.id)) options.unshift({ id: periode.tuteur.id, nom: nomComplet(periode.tuteur), detail: 'Tuteur actuel' });
  return (
    <FenetreFormulaire
      titre={mode === 'accepter' ? 'Accepter la période' : 'Changer de tuteur'}
      sousTitre={`${nomComplet(stage.stagiaire)} — ${periode.unite}`}
      onClose={onClose}
      largeur={600}
      onSubmit={() => lancer(() => (mode === 'accepter' ? accepterPeriode(stage.id, periode.id, tuteurId) : changerTuteur(stage.id, periode.id, tuteurId)), 'Action impossible')}
      libelleValider={mode === 'accepter' ? 'Accepter' : 'Changer'}
      enCours={enCours}
      erreur={erreurListe ?? erreur}
      pied="Le tuteur et le stagiaire sont prévenus."
    >
      <SelecteurPersonnes
        id="tu-tuteur"
        label="Tuteur"
        multiple={false}
        required
        messageObligatoire="Choisissez le tuteur."
        placeholder={candidats ? 'Rechercher un tuteur…' : 'Chargement des tuteurs possibles…'}
        options={options}
        valeurs={tuteurId ? [tuteurId] : []}
        onChange={(ids) => setTuteurId(ids[0] ?? '')}
      />
    </FenetreFormulaire>
  );
}

/** Action motivée générique (refus, renvoi, interruption). */
export function FenetreMotif({ titre, sousTitre, valider, action, onClose, onDone }: { titre: string; sousTitre?: string; valider: string; action: (motif: string) => Promise<unknown>; onClose: () => void; onDone: (s?: Stage) => void }) {
  const [motif, setMotif] = useState('');
  const { enCours, erreur, lancer } = useAction(onDone);
  return (
    <FenetreFormulaire
      titre={titre}
      onClose={onClose}
      largeur={560}
      onSubmit={() => lancer(() => action(motif.trim()), 'Action impossible')}
      valider={() => motifValide(motif, 'mo-motif')}
      libelleValider={valider}
      enCours={enCours}
      erreur={erreur}
      danger
      pied={sousTitre}
    >
      <ZoneTexte id="mo-motif" label="Motif" value={motif} onChange={setMotif} required messageObligatoire="Indiquez le motif." maxLength={1000} />
    </FenetreFormulaire>
  );
}

export function FenetreActeAttestation({ stage, onClose, onDone }: { stage: Stage; onClose: () => void; onDone: (s?: Stage) => void }) {
  const [registres, setRegistres] = useState<{ id: string; code: string; libelle: string }[] | null>(null);
  const [registreId, setRegistreId] = useState('');
  const { enCours, erreur, lancer } = useAction(onDone);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  useEffect(() => {
    getRegistresAttestation()
      .then((r) => {
        setRegistres(r);
        const att = r.find((x) => /attest/i.test(x.libelle) || /^ATT/i.test(x.code));
        if (att) setRegistreId(att.id);
      })
      .catch((e) => setErreurListe(messageErreur(e, 'Impossible de charger les registres')));
  }, []);
  return (
    <FenetreFormulaire
      titre="Préparer l’attestation finale"
      sousTitre={nomComplet(stage.stagiaire)}
      onClose={onClose}
      largeur={640}
      onSubmit={() => lancer(() => creerActeAttestation(stage.id, registreId), 'Préparation impossible')}
      libelleValider="Créer l’acte"
      enCours={enCours}
      erreur={erreurListe ?? erreur}
      pied="Le stagiaire est bénéficiaire de l’acte et en prend connaissance depuis son stage."
    >
      <p className="mb-3.5 text-[13px] text-text">
        Un acte est créé dans le module Courrier avec le document rempli ; il suit le circuit habituel (visa, signature par le DN ou la DNA, numéro).
      </p>
      <Liste
        id="ac-registre"
        label="Registre d’attestations"
        value={registreId}
        onChange={setRegistreId}
        required
        messageObligatoire="Choisissez le registre."
        vide={registres ? (registres.length ? 'Choisir…' : 'Aucun registre d’actes de la Direction') : 'Chargement…'}
        options={(registres ?? []).map((r) => ({ value: r.id, label: `${r.code} — ${r.libelle}` }))}
      />
    </FenetreFormulaire>
  );
}

/** Encadreur principal (DRH) : choisi parmi les tuteurs des périodes ; il valide le rapport de stage. */
export function FenetreEncadrant({ stage, onClose, onDone }: { stage: Stage; onClose: () => void; onDone: (s?: Stage) => void }) {
  const [choix, setChoix] = useState<Personne[] | null>(null);
  const [userId, setUserId] = useState(stage.encadrantPrincipal?.id ?? '');
  const { enCours, erreur, lancer } = useAction(onDone);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  useEffect(() => {
    getEncadrantsPossibles(stage.id)
      .then(setChoix)
      .catch((e) => setErreurListe(messageErreur(e, 'Impossible de charger les encadreurs possibles')));
  }, [stage.id]);
  const options = (choix ?? []).map((c) => ({ id: c.id, nom: nomComplet(c) }));
  if (stage.encadrantPrincipal && !options.some((o) => o.id === stage.encadrantPrincipal!.id)) options.unshift({ id: stage.encadrantPrincipal.id, nom: nomComplet(stage.encadrantPrincipal) });
  return (
    <FenetreFormulaire
      titre="Encadreur principal"
      sousTitre={nomComplet(stage.stagiaire)}
      onClose={onClose}
      largeur={600}
      onSubmit={() => lancer(() => designerEncadrant(stage.id, userId), 'Désignation impossible')}
      libelleValider="Désigner"
      enCours={enCours}
      erreur={erreurListe ?? erreur}
      pied="Il suit le stagiaire sur toute la durée du stage et valide son rapport ; il est prévenu."
    >
      <SelecteurPersonnes
        id="en-encadrant"
        label="Encadreur (parmi les tuteurs du plan)"
        multiple={false}
        required
        messageObligatoire="Choisissez l’encadreur."
        placeholder={choix ? (choix.length ? 'Rechercher un tuteur…' : 'Aucun tuteur désigné dans le plan') : 'Chargement…'}
        options={options}
        valeurs={userId ? [userId] : []}
        onChange={(ids) => setUserId(ids[0] ?? '')}
      />
    </FenetreFormulaire>
  );
}
