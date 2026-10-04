'use client';

import { useEffect, useState } from 'react';
import {
  completerPli,
  convertirEnTache,
  corrigerArrivee,
  enregistrerArrivee,
  getImputables,
  getMesHabilitations,
  imputer,
  requalifierPli,
  sousImputer,
  traiterImputation,
} from '../../lib/api/courrier';
import { getDirectory } from '../../lib/api/org';
import type { DirectoryUser } from '../../lib/org/types';
import type { Arrivee, Candidat, Confidentialite, Imputation, ImputationNature, Registre, Unite } from '../../lib/courrier/types';
import { NATURE_IMPUTATION_LABEL, formatDate } from '../../lib/courrier/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Field } from '../ui/Input';
import { Erreur, Fenetre, Libelle, MentionInterim, SELECT_CLASS, TEXTAREA_CLASS, messageErreur } from './ui';

function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Date saisie (jour) → instant ISO à midi local : jamais décalé d'un jour par le fuseau. */
const jourIso = (d: string) => new Date(`${d}T12:00:00`).toISOString();
/** Échéance : fin de journée locale. */
const finDeJourIso = (d: string) => new Date(`${d}T23:59:00`).toISOString();
const versJour = (iso: string | null) => (iso ? aujourdhuiDe(new Date(iso)) : '');
function aujourdhuiDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dérogation au contrôle des dates (même règle que l'API, qui reste seule juge). */
export interface Derogation {
  confirme: boolean;
  motif: string;
}
function anomaliesDates(dateReception: string, dateCourrier: string): string[] {
  const a: string[] = [];
  if (dateReception && dateReception > aujourdhui()) a.push('la date de réception est dans le futur');
  if (dateCourrier && dateReception && dateCourrier > dateReception) a.push('la date du courrier est postérieure à sa date de réception');
  return a;
}
/** Champs à envoyer : la dérogation n'est transmise que si elle est confirmée. */
const champsDerogation = (d: Derogation) => (d.confirme ? { derogationDate: true, motifDerogation: d.motif.trim() } : {});

function ControleDates({
  dateReception,
  dateCourrier,
  valeur,
  onChange,
}: {
  dateReception: string;
  dateCourrier: string;
  valeur: Derogation;
  onChange: (d: Derogation) => void;
}) {
  const anomalies = anomaliesDates(dateReception, dateCourrier);
  if (anomalies.length === 0) return null;
  return (
    <div className="mb-4 rounded-md border border-gold bg-gold-soft px-3.5 py-3 text-[12.5px] text-ink" data-testid="controle-dates">
      <p className="mb-2">
        <strong>Date inhabituelle :</strong> {anomalies.join(' ; ')}. Vérifiez la saisie, ou confirmez-la en indiquant le motif (il sera conservé et
        tracé).
      </p>
      <label className="flex items-start gap-2 font-semibold">
        <input type="checkbox" checked={valeur.confirme} onChange={(e) => onChange({ ...valeur, confirme: e.target.checked })} className="mt-0.5" />
        Je confirme cette date
      </label>
      {valeur.confirme && (
        <div className="mt-2.5">
          <Libelle htmlFor="motifDerogation">Motif de la dérogation (obligatoire)</Libelle>
          <textarea
            id="motifDerogation"
            className={`${TEXTAREA_CLASS} !min-h-[64px]`}
            value={valeur.motif}
            onChange={(e) => onChange({ ...valeur, motif: e.target.value })}
            required
            maxLength={1000}
          />
        </div>
      )}
    </div>
  );
}

/** Gestion commune de l'état d'une fenêtre (envoi, erreur API affichée telle quelle). */
function useEnvoi() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function envoyer(action: () => Promise<unknown>, defaut: string): Promise<boolean> {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
      return true;
    } catch (e) {
      setErreur(messageErreur(e, defaut));
      return false;
    } finally {
      setEnCours(false);
    }
  }
  return { enCours, erreur, setErreur, envoyer };
}

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------

/**
 * Enregistrement d'un courrier arrivée : registres et unités limités aux
 * habilitations de la personne. Un pli PERSONNEL ne porte ni objet ni scan
 * (fermé) et exige son destinataire.
 */
export function FenetreEnregistrer({ unites, onClose, onEnregistre }: { unites: Unite[]; onClose: () => void; onEnregistre: (a: Arrivee) => void }) {
  const [habs, setHabs] = useState<{ registre: Registre; uniteKey: string }[] | null>(null);
  const [annuaire, setAnnuaire] = useState<DirectoryUser[]>([]);
  const [registreId, setRegistreId] = useState('');
  const [uniteKey, setUniteKey] = useState('');
  const [dateReception, setDateReception] = useState(aujourdhui());
  const [expediteur, setExpediteur] = useState('');
  const [reference, setReference] = useState('');
  const [dateCourrier, setDateCourrier] = useState('');
  const [confidentialite, setConfidentialite] = useState<Confidentialite>('ORDINAIRE');
  const [objet, setObjet] = useState('');
  const [destinataireId, setDestinataireId] = useState('');
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [derogation, setDerogation] = useState<Derogation>({ confirme: false, motif: '' });
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();

  useEffect(() => {
    getMesHabilitations()
      .then((h) => {
        const arr = h.filter((x) => x.registre.nature === 'ARRIVEE');
        setHabs(arr);
        if (arr[0]) {
          setRegistreId(arr[0].registre.id);
          setUniteKey(arr[0].uniteKey);
        }
      })
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger vos habilitations')));
    getDirectory()
      .then(setAnnuaire)
      .catch(() => setAnnuaire([]));
  }, [setErreur]);

  const registres = [...new Map((habs ?? []).map((h) => [h.registre.id, h.registre])).values()];
  const registre = registres.find((r) => r.id === registreId);
  const unitesPermises = (habs ?? []).filter((h) => h.registre.id === registreId).map((h) => h.uniteKey);
  const libelleUnite = (k: string) => unites.find((u) => u.key === k)?.libelle ?? k;
  const personnel = confidentialite === 'PERSONNEL';

  return (
    <Fenetre
      titre="Enregistrer un courrier arrivée"
      sousTitre="Le numéro est attribué par le système à l’enregistrement, dans l’ordre d’arrivée."
      valider="Enregistrer"
      large
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        let cree: Arrivee | null = null;
        const ok = await envoyer(async () => {
          cree = await enregistrerArrivee(
            {
              registreId,
              uniteKey: registre?.portee === 'UNITE' ? uniteKey : undefined,
              dateReception: jourIso(dateReception),
              expediteur: expediteur.trim(),
              referenceExpediteur: reference.trim() || undefined,
              dateCourrier: dateCourrier ? jourIso(dateCourrier) : undefined,
              objet: personnel ? undefined : objet.trim(),
              confidentialite,
              destinataireId: personnel ? destinataireId : undefined,
              ...(anomaliesDates(dateReception, dateCourrier).length > 0 ? champsDerogation(derogation) : {}),
            },
            personnel ? [] : fichiers,
          );
        }, 'Enregistrement impossible');
        if (ok && cree) onEnregistre(cree);
      }}
    >
      <Erreur message={erreur} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <div className="mb-4">
          <Libelle htmlFor="registre">Registre</Libelle>
          <select
            id="registre"
            className={SELECT_CLASS}
            value={registreId}
            onChange={(e) => {
              setRegistreId(e.target.value);
              setUniteKey((habs ?? []).find((h) => h.registre.id === e.target.value)?.uniteKey ?? '');
            }}
            required
          >
            {habs === null && <option value="">Chargement…</option>}
            {registres.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.libelle}
              </option>
            ))}
          </select>
        </div>
        {registre?.portee === 'UNITE' && (
          <div className="mb-4">
            <Libelle htmlFor="unite">Unité</Libelle>
            <select id="unite" className={SELECT_CLASS} value={uniteKey} onChange={(e) => setUniteKey(e.target.value)} required>
              {unitesPermises.map((k) => (
                <option key={k} value={k}>
                  {libelleUnite(k)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Date de réception" id="dateReception" type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)} required />
        <div className="mb-4">
          <Libelle htmlFor="confidentialite">Confidentialité</Libelle>
          <select id="confidentialite" className={SELECT_CLASS} value={confidentialite} onChange={(e) => setConfidentialite(e.target.value as Confidentialite)}>
            <option value="ORDINAIRE">Ordinaire</option>
            <option value="CONFIDENTIEL">Confidentiel</option>
            <option value="PERSONNEL">Pli personnel (fermé)</option>
          </select>
        </div>
      </div>
      <Field label="Expéditeur" id="expediteur" value={expediteur} onChange={(e) => setExpediteur(e.target.value)} required minLength={2} maxLength={300} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Référence de l’expéditeur (facultatif)" id="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
        <Field label="Date du courrier (facultatif)" id="dateCourrier" type="date" value={dateCourrier} onChange={(e) => setDateCourrier(e.target.value)} />
      </div>
      <ControleDates dateReception={dateReception} dateCourrier={dateCourrier} valeur={derogation} onChange={setDerogation} />
      {personnel ? (
        <>
          <p className="mb-3 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink">
            Pli personnel : il est enregistré fermé — ni objet ni scan. Seul son destinataire en prend connaissance et le complète.
          </p>
          <div className="mb-4">
            <Libelle htmlFor="destinataire">Destinataire</Libelle>
            <select id="destinataire" className={SELECT_CLASS} value={destinataireId} onChange={(e) => setDestinataireId(e.target.value)} required>
              <option value="">Choisir…</option>
              {annuaire.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                  {u.jobTitle ? ` — ${u.jobTitle}` : ''}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4">
            <Libelle htmlFor="objet">Objet</Libelle>
            <textarea id="objet" className={TEXTAREA_CLASS} value={objet} onChange={(e) => setObjet(e.target.value)} required minLength={2} maxLength={500} />
          </div>
          <div className="mb-4">
            <Libelle htmlFor="scans">Scans (facultatif)</Libelle>
            <input id="scans" type="file" multiple className="w-full text-[13px]" onChange={(e) => setFichiers(Array.from(e.target.files ?? []))} />
          </div>
        </>
      )}
    </Fenetre>
  );
}

// ---------------------------------------------------------------------------
// Imputation et sous-imputation
// ---------------------------------------------------------------------------

/** Les personnes proposées viennent de GET /courrier/imputables : exactement
 * celles que le serveur accepterait (autorité, unité, doublon). */
export function FenetreImputer({
  arrivee,
  parent,
  onClose,
  onFait,
}: {
  arrivee: Arrivee;
  /** Sous-imputation : l'imputation reçue. */
  parent?: Imputation;
  onClose: () => void;
  onFait: () => void;
}) {
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [imputeAId, setImputeAId] = useState('');
  const [nature, setNature] = useState<ImputationNature>('ATTRIBUTION');
  const [instructions, setInstructions] = useState('');
  const [echeance, setEcheance] = useState(parent?.echeance ? versJour(parent.echeance) : '');
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();

  useEffect(() => {
    getImputables(parent ? { imputationId: parent.id } : { arriveeId: arrivee.id })
      .then(setCandidats)
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les personnes')));
  }, [arrivee.id, parent, setErreur]);

  return (
    <Fenetre
      titre={parent ? 'Sous-imputer' : 'Imputer le courrier'}
      sousTitre={
        parent ? (
          <>Au sein de votre périmètre{parent.echeance ? `, au plus tard pour le ${formatDate(parent.echeance)} (votre échéance)` : ''}.</>
        ) : (
          <>Courrier {arrivee.numero}</>
        )
      }
      valider={parent ? 'Sous-imputer' : 'Imputer'}
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (!imputeAId) return setErreur('Choisissez la personne.');
        const input = { imputeAId, nature, instructions: instructions.trim() || undefined, echeance: echeance ? finDeJourIso(echeance) : undefined };
        const ok = await envoyer(() => (parent ? sousImputer(parent.id, input) : imputer(arrivee.id, input)), 'Imputation impossible');
        if (ok) onFait();
      }}
    >
      <Erreur message={erreur} />
      <div className="mb-4">
        <Libelle htmlFor="impute">Imputer à</Libelle>
        <select id="impute" className={SELECT_CLASS} value={imputeAId} onChange={(e) => setImputeAId(e.target.value)} disabled={!candidats}>
          <option value="">{candidats === null ? 'Chargement…' : candidats.length === 0 ? 'Personne à qui imputer' : 'Choisir…'}</option>
          {candidats?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} — {c.jobTitle ?? ROLE_LABEL[c.role]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <div className="mb-4">
          <Libelle htmlFor="nature">Nature</Libelle>
          <select id="nature" className={SELECT_CLASS} value={nature} onChange={(e) => setNature(e.target.value as ImputationNature)}>
            {(Object.keys(NATURE_IMPUTATION_LABEL) as ImputationNature[]).map((n) => (
              <option key={n} value={n}>
                {NATURE_IMPUTATION_LABEL[n]}
              </option>
            ))}
          </select>
        </div>
        <Field label={parent?.echeance ? 'Échéance (obligatoire)' : 'Échéance (facultatif)'} id="echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} min={aujourdhui()} required={!!parent?.echeance} />
      </div>
      <div className="mb-4">
        <Libelle htmlFor="instructions">Instructions (facultatif)</Libelle>
        <textarea id="instructions" className={TEXTAREA_CLASS} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} />
      </div>
    </Fenetre>
  );
}

// ---------------------------------------------------------------------------
// Traitement, conversion en tâche
// ---------------------------------------------------------------------------

export function FenetreTraiter({ imputation, arrivee, onClose, onFait }: { imputation: Imputation; arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const [compteRendu, setCompteRendu] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const avis = imputation.nature === 'AVIS';
  return (
    <Fenetre
      titre="Marquer comme traité"
      sousTitre={`Courrier ${arrivee.numero} — ${NATURE_IMPUTATION_LABEL[imputation.nature].toLowerCase()}.`}
      valider="Marquer traité"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        const ok = await envoyer(() => traiterImputation(imputation.id, { compteRendu: compteRendu.trim() || undefined }), 'Traitement impossible');
        if (ok) onFait();
      }}
    >
      <Erreur message={erreur} />
      <Libelle htmlFor="compteRendu">{avis ? 'Votre avis (obligatoire)' : 'Compte rendu (facultatif)'}</Libelle>
      <textarea id="compteRendu" className={`${TEXTAREA_CLASS} mb-4`} value={compteRendu} onChange={(e) => setCompteRendu(e.target.value)} required={avis} maxLength={4000} />
    </Fenetre>
  );
}

export function FenetreConvertir({ imputation, arrivee, onClose, onFait }: { imputation: Imputation; arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const ordinaire = arrivee.confidentialite === 'ORDINAIRE';
  const [titre, setTitre] = useState(ordinaire ? `Courrier ${arrivee.numero} — ${arrivee.objet ?? ''}`.slice(0, 300) : '');
  const [echeance, setEcheance] = useState(versJour(imputation.echeance));
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <Fenetre
      titre="Convertir en tâche"
      sousTitre={
        ordinaire
          ? 'Une tâche est créée pour la personne imputée, avec vos instructions.'
          : 'Courrier confidentiel : la tâche portera un titre neutre, sans instructions, au niveau « Très confidentiel ».'
      }
      valider="Créer la tâche"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        const ok = await envoyer(
          () => convertirEnTache(imputation.id, { titre: ordinaire ? titre.trim() || undefined : undefined, dueDate: echeance ? finDeJourIso(echeance) : undefined }),
          'Conversion impossible',
        );
        if (ok) onFait();
      }}
    >
      <Erreur message={erreur} />
      {ordinaire && <Field label="Titre de la tâche" id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={300} />}
      <Field label="Échéance de la tâche" id="dueDate" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} required />
    </Fenetre>
  );
}

// ---------------------------------------------------------------------------
// Correction (secrétariat) — auditée avant/après, jamais le numéro
// ---------------------------------------------------------------------------

export function FenetreCorriger({ arrivee, onClose, onFait }: { arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const [v, setV] = useState({
    dateReception: versJour(arrivee.dateReception),
    expediteur: arrivee.expediteur,
    referenceExpediteur: arrivee.referenceExpediteur ?? '',
    dateCourrier: versJour(arrivee.dateCourrier),
    objet: arrivee.objet ?? '',
  });
  const [derogation, setDerogation] = useState<Derogation>({ confirme: false, motif: '' });
  const { enCours, erreur, envoyer } = useEnvoi();
  const personnel = arrivee.confidentialite === 'PERSONNEL';
  const datesModifiees = v.dateReception !== versJour(arrivee.dateReception) || (!!v.dateCourrier && v.dateCourrier !== versJour(arrivee.dateCourrier));
  return (
    <Fenetre
      titre="Corriger l’enregistrement"
      sousTitre="La correction est tracée (avant/après). Le numéro ne change jamais."
      valider="Enregistrer la correction"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        // N'envoie que ce qui a changé : l'historique ne montre que de vraies corrections.
        const diff: Parameters<typeof corrigerArrivee>[1] = {};
        if (v.dateReception !== versJour(arrivee.dateReception)) diff.dateReception = jourIso(v.dateReception);
        if (v.expediteur.trim() !== arrivee.expediteur) diff.expediteur = v.expediteur.trim();
        if (v.referenceExpediteur.trim() !== (arrivee.referenceExpediteur ?? '') && v.referenceExpediteur.trim()) diff.referenceExpediteur = v.referenceExpediteur.trim();
        if (v.dateCourrier && v.dateCourrier !== versJour(arrivee.dateCourrier)) diff.dateCourrier = jourIso(v.dateCourrier);
        if (!personnel && v.objet.trim() !== (arrivee.objet ?? '')) diff.objet = v.objet.trim();
        if (datesModifiees && anomaliesDates(v.dateReception, v.dateCourrier).length > 0) Object.assign(diff, champsDerogation(derogation));
        if (Object.keys(diff).length === 0) return onClose();
        const ok = await envoyer(() => corrigerArrivee(arrivee.id, diff), 'Correction impossible');
        if (ok) onFait();
      }}
    >
      <Erreur message={erreur} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Date de réception" id="c-dateReception" type="date" value={v.dateReception} onChange={(e) => setV({ ...v, dateReception: e.target.value })} required />
        <Field label="Date du courrier" id="c-dateCourrier" type="date" value={v.dateCourrier} onChange={(e) => setV({ ...v, dateCourrier: e.target.value })} />
      </div>
      {datesModifiees && <ControleDates dateReception={v.dateReception} dateCourrier={v.dateCourrier} valeur={derogation} onChange={setDerogation} />}
      <Field label="Expéditeur" id="c-expediteur" value={v.expediteur} onChange={(e) => setV({ ...v, expediteur: e.target.value })} required minLength={2} maxLength={300} />
      <Field label="Référence de l’expéditeur" id="c-reference" value={v.referenceExpediteur} onChange={(e) => setV({ ...v, referenceExpediteur: e.target.value })} maxLength={120} />
      {!personnel && arrivee.niveau !== 'EXISTENCE' && (
        <div className="mb-4">
          <Libelle htmlFor="c-objet">Objet</Libelle>
          <textarea id="c-objet" className={TEXTAREA_CLASS} value={v.objet} onChange={(e) => setV({ ...v, objet: e.target.value })} minLength={2} maxLength={500} />
        </div>
      )}
    </Fenetre>
  );
}

// ---------------------------------------------------------------------------
// Pli personnel — destinataire seul
// ---------------------------------------------------------------------------

export function FenetreCompleterPli({ arrivee, onClose, onFait }: { arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const [objet, setObjet] = useState(arrivee.objet ?? '');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <Fenetre
      titre="Compléter le pli"
      sousTitre="L’objet reste visible de vous seul tant que le pli est personnel."
      valider="Enregistrer"
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        const ok = await envoyer(() => completerPli(arrivee.id, objet.trim()), 'Enregistrement impossible');
        if (ok) onFait();
      }}
    >
      <Erreur message={erreur} />
      <Libelle htmlFor="p-objet">Objet</Libelle>
      <textarea id="p-objet" className={`${TEXTAREA_CLASS} mb-4`} value={objet} onChange={(e) => setObjet(e.target.value)} required minLength={2} maxLength={500} />
    </Fenetre>
  );
}

export function FenetreRequalifier({ arrivee, onClose, onFait }: { arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const [cible, setCible] = useState<'ORDINAIRE' | 'CONFIDENTIEL'>('CONFIDENTIEL');
  const [confirme, setConfirme] = useState(false);
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();
  return (
    <Fenetre
      titre="Requalifier le pli"
      sousTitre="Le pli entre dans le circuit normal du courrier pour être imputé. C’est définitif : il ne pourra plus redevenir personnel."
      valider="Requalifier définitivement"
      danger
      enCours={enCours}
      onClose={onClose}
      onSubmit={async () => {
        if (!confirme) return setErreur('Cochez la confirmation : la requalification est définitive.');
        const ok = await envoyer(() => requalifierPli(arrivee.id, cible), 'Requalification impossible');
        if (ok) onFait();
      }}
    >
      <Erreur message={erreur} />
      {!arrivee.objet && <p className="mb-3 text-[12.5px] text-clay">Complétez d’abord l’objet du pli.</p>}
      <Libelle htmlFor="r-cible">Nouvelle confidentialité</Libelle>
      <select id="r-cible" className={`${SELECT_CLASS} mb-3`} value={cible} onChange={(e) => setCible(e.target.value as 'ORDINAIRE' | 'CONFIDENTIEL')}>
        <option value="CONFIDENTIEL">Confidentiel</option>
        <option value="ORDINAIRE">Ordinaire</option>
      </select>
      <label className="mb-4 flex items-start gap-2 text-[12.5px]">
        <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} className="mt-0.5" />
        Je comprends que le pli ne sera plus personnel et que ce choix est définitif.
      </label>
    </Fenetre>
  );
}

// ---------------------------------------------------------------------------
// Imputation dans la fenêtre du courrier (refonte de l'interface, étape 5)
// ---------------------------------------------------------------------------

export const ID_FORMULAIRE_IMPUTER = 'formulaire-imputer';

/**
 * « Imputer ce courrier » directement dans la fenêtre : mêmes appels que FenetreImputer
 * (GET /courrier/imputables, imputer ou sous-imputer), puis, si la case est cochée, la
 * conversion en tâche existante (l'imputant en est l'auteur). La case « Ajouter une
 * sous-imputation » n'apparaît que si la personne a elle-même reçu une imputation qu'elle peut
 * sous-imputer (droits de l'API). Le bouton qui envoie est l'action principale de la colonne
 * de droite (attribut `form`).
 */
export function FormulaireImputer({
  arrivee,
  sousImputable,
  onFait,
  onEnCours,
}: {
  arrivee: Arrivee;
  /** Imputation reçue que la personne peut sous-imputer (droits.sousImputer), s'il y en a une. */
  sousImputable: Imputation | null;
  /** Après l'imputation (avertissement si la tâche de suivi n'a pas pu être créée). */
  onFait: (avertissement?: string) => void;
  /** Envoi en cours : la fenêtre désactive son bouton « Imputer ». */
  onEnCours?: (enCours: boolean) => void;
}) {
  const [sous, setSous] = useState(false);
  const parent = sous ? sousImputable : null;
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [imputeAId, setImputeAId] = useState('');
  const [nature, setNature] = useState<ImputationNature>('ATTRIBUTION');
  const [instructions, setInstructions] = useState('');
  const [echeance, setEcheance] = useState('');
  const [tache, setTache] = useState(false);
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();
  useEffect(() => onEnCours?.(enCours), [enCours, onEnCours]);

  useEffect(() => {
    setCandidats(null);
    setImputeAId('');
    if (parent?.echeance) setEcheance(versJour(parent.echeance));
    getImputables(parent ? { imputationId: parent.id } : { arriveeId: arrivee.id })
      .then(setCandidats)
      .catch((e) => setErreur(messageErreur(e, 'Impossible de charger les personnes')));
  }, [arrivee.id, parent, setErreur]);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!imputeAId) return setErreur('Choisissez la personne.');
    if (tache && !echeance) return setErreur('Indiquez l’échéance de traitement : elle sera celle de la tâche.');
    const input = { imputeAId, nature, instructions: instructions.trim() || undefined, echeance: echeance ? finDeJourIso(echeance) : undefined };
    let cree: { id: string } | null = null;
    const ok = await envoyer(async () => {
      cree = parent ? await sousImputer(parent.id, input) : await imputer(arrivee.id, input);
    }, 'Imputation impossible');
    if (!ok || !cree) return;
    if (tache) {
      const id = (cree as { id: string }).id;
      const okTache = await envoyer(() => convertirEnTache(id, { dueDate: finDeJourIso(echeance) }), 'La tâche de suivi n’a pas pu être créée');
      if (!okTache) return onFait('Courrier imputé, mais la tâche de suivi n’a pas pu être créée : utilisez « Convertir en tâche » sur l’imputation.');
    }
    onFait();
  }

  const champ = 'h-[38px] w-full rounded-[9px] border border-line bg-surface px-[11px] text-[13.5px] focus:border-ink focus:outline focus:outline-2 focus:outline-ink';
  const libelle = 'mb-[5px] block text-[12.5px] font-semibold text-text-muted';
  return (
    <form id={ID_FORMULAIRE_IMPUTER} onSubmit={soumettre} aria-label={parent ? 'Sous-imputer ce courrier' : 'Imputer ce courrier'} data-testid="formulaire-imputer" className="mb-[18px]">
      <h3 className="mb-2 text-[13px] font-bold text-ink-900">{parent ? 'Sous-imputer ce courrier' : 'Imputer ce courrier'}</h3>
      {parent && (
        <p className="mb-2 text-[12.5px] text-text-muted">
          Au sein de votre périmètre{parent.echeance ? `, au plus tard pour le ${formatDate(parent.echeance)} (votre échéance)` : ''}.
        </p>
      )}
      <Erreur message={erreur} />
      <div className="grid gap-x-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="mb-2.5">
          <label htmlFor="imp-a" className={libelle}>
            À
          </label>
          <select id="imp-a" className={champ} value={imputeAId} onChange={(e) => setImputeAId(e.target.value)} disabled={!candidats}>
            <option value="">{candidats === null ? 'Chargement…' : candidats.length === 0 ? 'Personne à qui imputer' : 'Choisir…'}</option>
            {candidats?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} — {c.jobTitle ?? ROLE_LABEL[c.role]}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-2.5">
          <label htmlFor="imp-echeance" className={libelle}>
            Échéance de traitement{parent?.echeance ? ' (obligatoire)' : ''}
          </label>
          <input id="imp-echeance" type="date" className={champ} value={echeance} onChange={(e) => setEcheance(e.target.value)} min={aujourdhui()} required={!!parent?.echeance} />
        </div>
      </div>
      <div className="mb-2.5 sm:w-1/2 sm:pr-[5px]">
        <label htmlFor="imp-nature" className={libelle}>
          Nature
        </label>
        <select id="imp-nature" className={champ} value={nature} onChange={(e) => setNature(e.target.value as ImputationNature)}>
          {(Object.keys(NATURE_IMPUTATION_LABEL) as ImputationNature[]).map((n) => (
            <option key={n} value={n}>
              {NATURE_IMPUTATION_LABEL[n]}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2.5">
        <label htmlFor="imp-instruction" className={libelle}>
          Instruction
        </label>
        <textarea
          id="imp-instruction"
          className={`${champ} !h-auto min-h-[58px] py-2`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={2000}
          placeholder="Préparer une note, proposer des agents…"
        />
      </div>
      <label className="my-1 flex items-center gap-[9px] text-[13.5px]">
        <input type="checkbox" checked={tache} onChange={(e) => setTache(e.target.checked)} className="h-[17px] w-[17px] accent-ink" />
        Créer aussi une tâche pour le suivi
      </label>
      {sousImputable && (
        <label className="my-1 flex items-center gap-[9px] text-[13.5px]">
          <input type="checkbox" checked={sous} onChange={(e) => setSous(e.target.checked)} className="h-[17px] w-[17px] accent-ink" />
          Ajouter une sous-imputation
        </label>
      )}
      <MentionInterim />
    </form>
  );
}
