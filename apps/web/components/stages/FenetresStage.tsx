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
import { Erreur, Fenetre, Libelle, SELECT_CLASS, TEXTAREA_CLASS, messageErreur } from '../courrier/ui';

const jourIso = (d: string) => d.slice(0, 10);

/** Exécute une action et affiche le refus de l'API tel quel. */
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

function Champ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <Libelle htmlFor={id}>{label}</Libelle>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- stage

export function FenetreNouveauStage({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Stage) => void }) {
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [v, setV] = useState({ stagiaireId: '', etablissement: '', diplomePrepare: '', encadrantAcademique: '', dateDebut: '', dateFin: '' });
  const { enCours, erreur, lancer } = useAction((s) => s && onCreated(s));
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  useEffect(() => {
    getStagiairesDisponibles()
      .then(setCandidats)
      .catch((e) => setErreurListe(messageErreur(e, 'Impossible de charger les stagiaires')));
  }, []);
  return (
    <Fenetre
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
      valider="Créer le stage"
      enCours={enCours}
    >
      <Champ id="ns-stagiaire" label="Stagiaire">
        <select id="ns-stagiaire" className={SELECT_CLASS} value={v.stagiaireId} onChange={(e) => setV({ ...v, stagiaireId: e.target.value })} required>
          <option value="">{candidats ? (candidats.length ? 'Choisir…' : 'Aucun compte stagiaire disponible') : 'Chargement…'}</option>
          {candidats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} — {c.email}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="ns-etab" label="Établissement d’origine">
        <input id="ns-etab" className={SELECT_CLASS} value={v.etablissement} onChange={(e) => setV({ ...v, etablissement: e.target.value })} required minLength={2} maxLength={200} />
      </Champ>
      <Champ id="ns-diplome" label="Diplôme préparé (facultatif)">
        <input id="ns-diplome" className={SELECT_CLASS} value={v.diplomePrepare} onChange={(e) => setV({ ...v, diplomePrepare: e.target.value })} maxLength={200} />
      </Champ>
      <Champ id="ns-encadrant" label="Encadrant académique (facultatif)">
        <input id="ns-encadrant" className={SELECT_CLASS} value={v.encadrantAcademique} onChange={(e) => setV({ ...v, encadrantAcademique: e.target.value })} maxLength={200} />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ id="ns-debut" label="Début">
          <input id="ns-debut" type="date" className={SELECT_CLASS} value={v.dateDebut} onChange={(e) => setV({ ...v, dateDebut: e.target.value })} required />
        </Champ>
        <Champ id="ns-fin" label="Fin">
          <input id="ns-fin" type="date" className={SELECT_CLASS} value={v.dateFin} onChange={(e) => setV({ ...v, dateFin: e.target.value })} required />
        </Champ>
      </div>
      <Erreur message={erreurListe ?? erreur} />
    </Fenetre>
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
  return (
    <Fenetre
      titre="Modifier le stage"
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
      valider="Enregistrer"
      enCours={enCours}
    >
      <Champ id="ms-etab" label="Établissement d’origine">
        <input id="ms-etab" className={SELECT_CLASS} value={v.etablissement} onChange={(e) => setV({ ...v, etablissement: e.target.value })} required minLength={2} />
      </Champ>
      <Champ id="ms-diplome" label="Diplôme préparé">
        <input id="ms-diplome" className={SELECT_CLASS} value={v.diplomePrepare} onChange={(e) => setV({ ...v, diplomePrepare: e.target.value })} />
      </Champ>
      <Champ id="ms-encadrant" label="Encadrant académique">
        <input id="ms-encadrant" className={SELECT_CLASS} value={v.encadrantAcademique} onChange={(e) => setV({ ...v, encadrantAcademique: e.target.value })} />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ id="ms-debut" label="Début">
          <input id="ms-debut" type="date" className={SELECT_CLASS} value={v.dateDebut} onChange={(e) => setV({ ...v, dateDebut: e.target.value })} required />
        </Champ>
        <Champ id="ms-fin" label="Fin">
          <input id="ms-fin" type="date" className={SELECT_CLASS} value={v.dateFin} onChange={(e) => setV({ ...v, dateFin: e.target.value })} required />
        </Champ>
      </div>
      <Erreur message={erreur} />
    </Fenetre>
  );
}

// -------------------------------------------------------------- période

/** Choix de l'unité d'accueil : Division (section facultative) ou Cellule,
 * unités actives seulement (l'API refuse une unité suspendue). */
export function ChoixUnite({
  value,
  onChange,
}: {
  value: { divisionId: string | null; sectionId: string | null; celluleId: string | null };
  onChange: (v: { divisionId: string | null; sectionId: string | null; celluleId: string | null }) => void;
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
          <select aria-label="Division" className={SELECT_CLASS} value={value.divisionId ?? ''} onChange={(e) => onChange({ ...vide, divisionId: e.target.value || null })} required>
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
        <select aria-label="Cellule" className={SELECT_CLASS} value={value.celluleId ?? ''} onChange={(e) => onChange({ ...vide, celluleId: e.target.value || null })} required>
          <option value="">Cellule…</option>
          {cellules.filter((c) => c.isActive).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
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
  function valider() {
    if (periode && commencee) return lancer(() => modifierPeriode(stage.id, periode.id, { dateFin: v.dateFin, motif: v.motif.trim() }), 'Modification impossible');
    const input = { ...unite, dateDebut: v.dateDebut, dateFin: v.dateFin, formatEvaluation: v.formatEvaluation, objectifs: v.objectifs.trim() };
    return lancer(() => (periode ? modifierPeriode(stage.id, periode.id, input) : ajouterPeriode(stage.id, input)), 'Enregistrement impossible');
  }
  return (
    <Fenetre
      titre={periode ? 'Modifier la période' : 'Ajouter une période'}
      sousTitre={
        commencee
          ? 'Période en cours : seule la date de fin se modifie, avec un motif.'
          : 'La capacité d’accueil de l’unité est vérifiée ; l’unité accepte ensuite la période et désigne le tuteur.'
      }
      onClose={onClose}
      onSubmit={valider}
      valider="Enregistrer"
      enCours={enCours}
    >
      {!commencee && (
        <>
          <Libelle>Unité d’accueil</Libelle>
          <ChoixUnite value={unite} onChange={setUnite} />
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        {!commencee && (
          <Champ id="pe-debut" label="Du">
            <input id="pe-debut" type="date" className={SELECT_CLASS} value={v.dateDebut} min={jourIso(stage.dateDebut)} max={jourIso(stage.dateFin)} onChange={(e) => setV({ ...v, dateDebut: e.target.value })} required />
          </Champ>
        )}
        <Champ id="pe-fin" label="Au">
          <input id="pe-fin" type="date" className={SELECT_CLASS} value={v.dateFin} min={jourIso(stage.dateDebut)} max={jourIso(stage.dateFin)} onChange={(e) => setV({ ...v, dateFin: e.target.value })} required />
        </Champ>
      </div>
      {!commencee && (
        <>
          <Champ id="pe-format" label="Évaluation de fin de période">
            <select id="pe-format" className={SELECT_CLASS} value={v.formatEvaluation} onChange={(e) => setV({ ...v, formatEvaluation: e.target.value as FormatEvaluation })}>
              {(Object.keys(FORMAT_LABEL) as FormatEvaluation[]).map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="pe-obj" label="Objectifs (facultatif)">
            <textarea id="pe-obj" className={TEXTAREA_CLASS} value={v.objectifs} onChange={(e) => setV({ ...v, objectifs: e.target.value })} maxLength={2000} />
          </Champ>
        </>
      )}
      {commencee && (
        <Champ id="pe-motif" label="Motif">
          <textarea id="pe-motif" className={TEXTAREA_CLASS} value={v.motif} onChange={(e) => setV({ ...v, motif: e.target.value })} required minLength={5} />
        </Champ>
      )}
      <Erreur message={erreur} />
    </Fenetre>
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
  return (
    <Fenetre
      titre={mode === 'accepter' ? 'Accepter la période' : 'Changer de tuteur'}
      sousTitre={`${stage.stagiaire.firstName} ${stage.stagiaire.lastName} — ${periode.unite}`}
      onClose={onClose}
      onSubmit={() => lancer(() => (mode === 'accepter' ? accepterPeriode(stage.id, periode.id, tuteurId) : changerTuteur(stage.id, periode.id, tuteurId)), 'Action impossible')}
      valider={mode === 'accepter' ? 'Accepter' : 'Changer'}
      enCours={enCours}
    >
      <Champ id="tu-tuteur" label="Tuteur">
        <select id="tu-tuteur" className={SELECT_CLASS} value={tuteurId} onChange={(e) => setTuteurId(e.target.value)} required>
          <option value="">{candidats ? 'Choisir…' : 'Chargement…'}</option>
          {candidats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
              {c.jobTitle ? ` — ${c.jobTitle}` : ''}
            </option>
          ))}
        </select>
      </Champ>
      <Erreur message={erreurListe ?? erreur} />
    </Fenetre>
  );
}

/** Action motivée générique (refus, renvoi, interruption). */
export function FenetreMotif({ titre, sousTitre, valider, action, onClose, onDone }: { titre: string; sousTitre?: string; valider: string; action: (motif: string) => Promise<unknown>; onClose: () => void; onDone: (s?: Stage) => void }) {
  const [motif, setMotif] = useState('');
  const { enCours, erreur, lancer } = useAction(onDone);
  return (
    <Fenetre titre={titre} sousTitre={sousTitre} onClose={onClose} onSubmit={() => lancer(() => action(motif.trim()), 'Action impossible')} valider={valider} enCours={enCours} danger>
      <Champ id="mo-motif" label="Motif">
        <textarea id="mo-motif" className={TEXTAREA_CLASS} value={motif} onChange={(e) => setMotif(e.target.value)} required minLength={5} maxLength={1000} />
      </Champ>
      <Erreur message={erreur} />
    </Fenetre>
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
    <Fenetre
      titre="Préparer l’attestation finale"
      sousTitre="Un acte est créé dans le module Courrier avec le document rempli ; il suit le circuit habituel (visa, signature par le DN ou la DNA, numéro). Le stagiaire en est bénéficiaire et en prend connaissance depuis son stage."
      onClose={onClose}
      onSubmit={() => lancer(() => creerActeAttestation(stage.id, registreId), 'Préparation impossible')}
      valider="Créer l’acte"
      enCours={enCours}
    >
      <Champ id="ac-registre" label="Registre d’attestations">
        <select id="ac-registre" className={SELECT_CLASS} value={registreId} onChange={(e) => setRegistreId(e.target.value)} required>
          <option value="">{registres ? (registres.length ? 'Choisir…' : 'Aucun registre d’actes de la Direction') : 'Chargement…'}</option>
          {registres?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.libelle}
            </option>
          ))}
        </select>
      </Champ>
      <Erreur message={erreurListe ?? erreur} />
    </Fenetre>
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
  return (
    <Fenetre
      titre="Encadreur principal"
      sousTitre="Il suit le stagiaire sur toute la durée du stage et valide son rapport."
      onClose={onClose}
      onSubmit={() => lancer(() => designerEncadrant(stage.id, userId), 'Désignation impossible')}
      valider="Désigner"
      enCours={enCours}
    >
      <Champ id="en-encadrant" label="Encadreur (parmi les tuteurs du plan)">
        <select id="en-encadrant" className={SELECT_CLASS} value={userId} onChange={(e) => setUserId(e.target.value)} required>
          <option value="">{choix ? (choix.length ? 'Choisir…' : 'Aucun tuteur désigné dans le plan') : 'Chargement…'}</option>
          {choix?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </Champ>
      <Erreur message={erreurListe ?? erreur} />
    </Fenetre>
  );
}
