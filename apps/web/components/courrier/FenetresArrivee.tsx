'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
import { useAuth } from '../../lib/auth/AuthProvider';
import type { DirectoryUser } from '../../lib/org/types';
import type { Arrivee, Candidat, Confidentialite, Imputation, ImputationNature, Registre, Unite } from '../../lib/courrier/types';
import { NATURE_IMPUTATION_LABEL, formatDate } from '../../lib/courrier/types';
import { Case, ChampDate, ChoixSegment, FenetreFormulaire, Grille2, Liste, MessageErreurChamp, Saisie, SelecteurPersonnes, ZoneDepot, ZoneTexte } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';
import { ErreurSousChamp, SqueletteChamps, jourLocal, nomDe, useEnvoi, versPersonne } from './formulaire';
import { MentionInterim } from './ui';

const aujourdhui = () => jourLocal(0);
/** Date saisie (jour) → instant ISO à midi local : jamais décalé d'un jour par le fuseau. */
const jourIso = (d: string) => new Date(`${d}T12:00:00`).toISOString();
/** Échéance : fin de journée locale. */
const finDeJourIso = (d: string) => new Date(`${d}T23:59:00`).toISOString();
const versJour = (iso: string | null) => (iso ? aujourdhuiDe(new Date(iso)) : '');
function aujourdhuiDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const NATURES = (Object.keys(NATURE_IMPUTATION_LABEL) as ImputationNature[]).map((n) => ({ value: n, label: NATURE_IMPUTATION_LABEL[n] }));

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
/** Règle de la fenêtre : une date inhabituelle doit être confirmée (ou corrigée). */
const regleDerogation = (anomalies: string[], d: Derogation): Record<string, string> =>
  anomalies.length > 0 && !d.confirme ? { derogationConfirme: 'Confirmez cette date inhabituelle, ou corrigez-la.' } : {};

function ControleDates({ dateReception, dateCourrier, valeur, onChange }: { dateReception: string; dateCourrier: string; valeur: Derogation; onChange: (d: Derogation) => void }) {
  const anomalies = anomaliesDates(dateReception, dateCourrier);
  if (anomalies.length === 0) return null;
  return (
    <div className="mb-3.5 rounded-[10px] border border-gold-bord bg-gold-50 px-3.5 pb-1 pt-3 text-[12.5px] text-ink" data-testid="controle-dates">
      <p className="mb-2.5">
        <strong>Date inhabituelle :</strong> {anomalies.join(' ; ')}. Vérifiez la saisie, ou confirmez-la en indiquant le motif (il sera conservé et tracé).
      </p>
      <Case id="derogationConfirme" label="Je confirme cette date" checked={valeur.confirme} onChange={(confirme) => onChange({ ...valeur, confirme })} />
      <div className="-mt-2 mb-2">
        <MessageErreurChamp id="derogationConfirme" />
      </div>
      {valeur.confirme && (
        <ZoneTexte id="motifDerogation" label="Motif de la dérogation" value={valeur.motif} onChange={(motif) => onChange({ ...valeur, motif })} required maxLength={1000} lignes={2} messageObligatoire="Indiquez le motif de la dérogation." />
      )}
    </div>
  );
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
  const toast = useToast();
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
      .catch((e) => {
        setHabs([]);
        setErreur(messageErreur(e, 'Vos habilitations n’ont pas pu être lues. Réessayez dans un instant.'));
      });
    getDirectory()
      .then(setAnnuaire)
      .catch(() => setAnnuaire([]));
  }, [setErreur]);

  const registres = [...new Map((habs ?? []).map((h) => [h.registre.id, h.registre])).values()];
  const registre = registres.find((r) => r.id === registreId);
  const unitesPermises = (habs ?? []).filter((h) => h.registre.id === registreId).map((h) => h.uniteKey);
  const libelleUnite = (k: string) => unites.find((u) => u.key === k)?.libelle ?? k;
  const personnel = confidentialite === 'PERSONNEL';
  const anomalies = anomaliesDates(dateReception, dateCourrier);
  const personnes = annuaire.map((u) => versPersonne(u));

  return (
    <FenetreFormulaire
      titre="Enregistrer un courrier arrivée"
      sousTitre="Le numéro est attribué par le système à l’enregistrement, dans l’ordre d’arrivée."
      libelleValider="Enregistrer le courrier"
      testid="fenetre-enregistrer"
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied={personnel ? 'Le pli reste fermé : seul son destinataire en prend connaissance.' : 'Le courrier rejoint les arrivées « À imputer » ; la fenêtre du courrier s’ouvre ensuite.'}
      valider={() => ({
        ...(expediteur.trim().length === 1 ? { expediteur: 'Indiquez au moins 2 caractères.' } : {}),
        ...(!personnel && objet.trim().length === 1 ? { objet: 'Indiquez au moins 2 caractères.' } : {}),
        ...regleDerogation(anomalies, derogation),
      })}
      onSubmit={async () => {
        const r = await envoyer(() =>
          enregistrerArrivee(
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
              ...(anomalies.length > 0 ? champsDerogation(derogation) : {}),
            },
            personnel ? [] : fichiers,
          ),
        );
        if (!r.ok) return;
        toast.succes(`Courrier ${r.valeur.numero} enregistré`, { detail: personnel ? `Pli fermé pour ${nomDe(personnes, destinataireId)}.` : 'Il attend son imputation.' });
        onEnregistre(r.valeur);
      }}
    >
      {habs === null ? (
        <SqueletteChamps champs={4} />
      ) : (
        <>
          <Grille2>
            <Liste
              id="registre"
              label="Registre"
              value={registreId}
              onChange={(v) => {
                setRegistreId(v);
                setUniteKey((habs ?? []).find((h) => h.registre.id === v)?.uniteKey ?? '');
              }}
              options={registres.map((r) => ({ value: r.id, label: `${r.code} — ${r.libelle}` }))}
              vide={registres.length === 0 ? 'Aucun registre ne vous est ouvert' : undefined}
              required
              messageObligatoire="Choisissez le registre."
            />
            {registre?.portee === 'UNITE' && (
              <Liste id="unite" label="Unité" value={uniteKey} onChange={setUniteKey} options={unitesPermises.map((k) => ({ value: k, label: libelleUnite(k) }))} required messageObligatoire="Choisissez l’unité." />
            )}
          </Grille2>
          <ChoixSegment<Confidentialite>
            id="confidentialite"
            label="Confidentialité"
            value={confidentialite}
            onChange={setConfidentialite}
            options={[
              { value: 'ORDINAIRE', label: 'Ordinaire' },
              { value: 'CONFIDENTIEL', label: 'Confidentiel' },
              { value: 'PERSONNEL', label: 'Pli personnel (fermé)' },
            ]}
          />
          <Grille2>
            <ChampDate id="dateReception" label="Date de réception" value={dateReception} onChange={setDateReception} required messageObligatoire="Indiquez la date de réception." />
            <ChampDate id="dateCourrier" label="Date du courrier" facultatif value={dateCourrier} onChange={setDateCourrier} />
          </Grille2>
          <ControleDates dateReception={dateReception} dateCourrier={dateCourrier} valeur={derogation} onChange={setDerogation} />
          <Grille2>
            <Saisie id="expediteur" label="Expéditeur" value={expediteur} onChange={setExpediteur} required maxLength={300} messageObligatoire="Indiquez l’expéditeur." placeholder="Ministère, organisme, personne…" />
            <Saisie id="reference" label="Référence de l’expéditeur" facultatif value={reference} onChange={setReference} maxLength={120} />
          </Grille2>
          {personnel ? (
            <>
              <p className="mb-3.5 rounded-[10px] bg-gold-50 px-3.5 py-2.5 text-[12.5px] text-ink">
                Pli personnel : il est enregistré fermé — ni objet ni scan. Seul son destinataire en prend connaissance et le complète.
              </p>
              <SelecteurPersonnes
                id="destinataire"
                label="Destinataire"
                options={personnes}
                valeurs={destinataireId ? [destinataireId] : []}
                onChange={(ids) => setDestinataireId(ids[0] ?? '')}
                multiple={false}
                required
                messageObligatoire="Choisissez un destinataire."
              />
            </>
          ) : (
            <>
              <ZoneTexte id="objet" label="Objet" value={objet} onChange={setObjet} required maxLength={500} lignes={2} messageObligatoire="Indiquez l’objet du courrier." />
              <ZoneDepot id="scans" label="Scans" facultatif multiple fichiers={fichiers} onChange={setFichiers} />
            </>
          )}
          <MentionInterim />
        </>
      )}
    </FenetreFormulaire>
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
  const toast = useToast();
  const { user } = useAuth();
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [imputeAId, setImputeAId] = useState('');
  const [nature, setNature] = useState<ImputationNature>('ATTRIBUTION');
  const [instructions, setInstructions] = useState('');
  const [echeance, setEcheance] = useState(parent?.echeance ? versJour(parent.echeance) : '');
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();

  useEffect(() => {
    getImputables(parent ? { imputationId: parent.id } : { arriveeId: arrivee.id })
      .then(setCandidats)
      .catch((e) => {
        setCandidats([]);
        setErreur(messageErreur(e, 'Les personnes à qui imputer n’ont pas pu être lues.'));
      });
  }, [arrivee.id, parent, setErreur]);
  const personnes = (candidats ?? []).map((c) => versPersonne(c));

  return (
    <FenetreFormulaire
      titre={parent ? 'Sous-imputer' : 'Imputer le courrier'}
      sousTitre={parent ? <>Au sein de votre périmètre{parent.echeance ? `, au plus tard pour le ${formatDate(parent.echeance)} (votre échéance)` : ''}.</> : <>Courrier {arrivee.numero}</>}
      libelleValider={parent ? 'Sous-imputer' : 'Imputer'}
      largeur={640}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="La personne choisie est prévenue immédiatement."
      onSubmit={async () => {
        const input = { imputeAId, nature, instructions: instructions.trim() || undefined, echeance: echeance ? finDeJourIso(echeance) : undefined };
        const r = await envoyer(() => (parent ? sousImputer(parent.id, input) : imputer(arrivee.id, input)));
        if (!r.ok) return;
        toast.succes(parent ? 'Courrier sous-imputé' : 'Courrier imputé', { detail: imputeAId === user?.id ? undefined : `${nomDe(personnes, imputeAId)} a été prévenu(e).` });
        onFait();
      }}
    >
      {candidats === null ? (
        <SqueletteChamps champs={3} />
      ) : (
        <>
          <SelecteurPersonnes
            id="impute"
            label="Imputer à"
            options={personnes}
            valeurs={imputeAId ? [imputeAId] : []}
            onChange={(ids) => setImputeAId(ids[0] ?? '')}
            multiple={false}
            required
            messageObligatoire="Choisissez un destinataire."
            placeholder={personnes.length === 0 ? 'Personne à qui imputer' : 'Rechercher une personne…'}
          />
          <Grille2>
            <ChoixSegment<ImputationNature> id="nature" label="Nature" value={nature} onChange={setNature} options={NATURES} />
            <ChampDate
              id="echeance"
              label="Échéance"
              facultatif={!parent?.echeance}
              value={echeance}
              onChange={setEcheance}
              min={aujourdhui()}
              max={parent?.echeance ? versJour(parent.echeance) : undefined}
              required={!!parent?.echeance}
              messageObligatoire="Indiquez l’échéance (au plus tard la vôtre)."
            />
          </Grille2>
          <ZoneTexte id="instructions" label="Instructions" facultatif value={instructions} onChange={setInstructions} maxLength={2000} />
          <MentionInterim />
        </>
      )}
    </FenetreFormulaire>
  );
}

// ---------------------------------------------------------------------------
// Traitement, conversion en tâche
// ---------------------------------------------------------------------------

export function FenetreTraiter({ imputation, arrivee, onClose, onFait }: { imputation: Imputation; arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [compteRendu, setCompteRendu] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi();
  const avis = imputation.nature === 'AVIS';
  return (
    <FenetreFormulaire
      titre="Marquer comme traité"
      sousTitre={`Courrier ${arrivee.numero} — ${NATURE_IMPUTATION_LABEL[imputation.nature].toLowerCase()}.`}
      libelleValider="Marquer traité"
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="La personne qui vous a imputé ce courrier voit votre compte rendu."
      onSubmit={async () => {
        const r = await envoyer(() => traiterImputation(imputation.id, { compteRendu: compteRendu.trim() || undefined }));
        if (!r.ok) return;
        toast.succes('Imputation traitée', { detail: `Courrier ${arrivee.numero}.` });
        onFait();
      }}
    >
      <ZoneTexte
        id="compteRendu"
        label={avis ? 'Votre avis' : 'Compte rendu'}
        facultatif={!avis}
        value={compteRendu}
        onChange={setCompteRendu}
        required={avis}
        maxLength={4000}
        lignes={4}
        messageObligatoire="Donnez votre avis : il est demandé pour ce courrier."
      />
      <MentionInterim />
    </FenetreFormulaire>
  );
}

export function FenetreConvertir({ imputation, arrivee, onClose, onFait }: { imputation: Imputation; arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const ordinaire = arrivee.confidentialite === 'ORDINAIRE';
  const [titre, setTitre] = useState(ordinaire ? `Courrier ${arrivee.numero} — ${arrivee.objet ?? ''}`.slice(0, 300) : '');
  const [echeance, setEcheance] = useState(versJour(imputation.echeance));
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Convertir en tâche"
      sousTitre={ordinaire ? 'Une tâche est créée pour la personne imputée, avec vos instructions.' : 'Courrier confidentiel : la tâche portera un titre neutre, sans instructions, au niveau « Très confidentiel ».'}
      libelleValider="Créer la tâche"
      largeur={600}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="La personne imputée retrouve la tâche dans « Mes tâches »."
      onSubmit={async () => {
        const r = await envoyer(() => convertirEnTache(imputation.id, { titre: ordinaire ? titre.trim() || undefined : undefined, dueDate: echeance ? finDeJourIso(echeance) : undefined }));
        if (!r.ok) return;
        toast.succes('Tâche créée', { detail: `Liée au courrier ${arrivee.numero}.` });
        onFait();
      }}
    >
      {ordinaire && <Saisie id="titre" label="Titre de la tâche" facultatif value={titre} onChange={setTitre} maxLength={300} />}
      <ChampDate id="dueDate" label="Échéance de la tâche" value={echeance} onChange={setEcheance} required min={aujourdhui()} messageObligatoire="Indiquez l’échéance de la tâche." />
      <MentionInterim />
    </FenetreFormulaire>
  );
}

// ---------------------------------------------------------------------------
// Correction (secrétariat) — auditée avant/après, jamais le numéro
// ---------------------------------------------------------------------------

export function FenetreCorriger({ arrivee, onClose, onFait }: { arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
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
  const anomalies = datesModifiees ? anomaliesDates(v.dateReception, v.dateCourrier) : [];
  return (
    <FenetreFormulaire
      titre="Corriger l’enregistrement"
      sousTitre="La correction est tracée (avant/après). Le numéro ne change jamais."
      libelleValider="Enregistrer la correction"
      largeur={720}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      pied="Seuls les champs modifiés sont enregistrés et tracés."
      valider={() => ({
        ...(v.expediteur.trim().length === 1 ? { 'c-expediteur': 'Indiquez au moins 2 caractères.' } : {}),
        ...(!personnel && v.objet.trim().length === 1 ? { 'c-objet': 'Indiquez au moins 2 caractères.' } : {}),
        ...regleDerogation(anomalies, derogation),
      })}
      onSubmit={async () => {
        // N'envoie que ce qui a changé : l'historique ne montre que de vraies corrections.
        const diff: Parameters<typeof corrigerArrivee>[1] = {};
        if (v.dateReception !== versJour(arrivee.dateReception)) diff.dateReception = jourIso(v.dateReception);
        if (v.expediteur.trim() !== arrivee.expediteur) diff.expediteur = v.expediteur.trim();
        if (v.referenceExpediteur.trim() !== (arrivee.referenceExpediteur ?? '') && v.referenceExpediteur.trim()) diff.referenceExpediteur = v.referenceExpediteur.trim();
        if (v.dateCourrier && v.dateCourrier !== versJour(arrivee.dateCourrier)) diff.dateCourrier = jourIso(v.dateCourrier);
        if (!personnel && v.objet.trim() !== (arrivee.objet ?? '')) diff.objet = v.objet.trim();
        if (anomalies.length > 0) Object.assign(diff, champsDerogation(derogation));
        if (Object.keys(diff).length === 0) return onClose();
        const r = await envoyer(() => corrigerArrivee(arrivee.id, diff));
        if (!r.ok) return;
        toast.succes('Correction enregistrée', { detail: `Courrier ${arrivee.numero} : l’historique garde l’avant et l’après.` });
        onFait();
      }}
    >
      <Grille2>
        <ChampDate id="c-dateReception" label="Date de réception" value={v.dateReception} onChange={(dateReception) => setV({ ...v, dateReception })} required />
        <ChampDate id="c-dateCourrier" label="Date du courrier" facultatif value={v.dateCourrier} onChange={(dateCourrier) => setV({ ...v, dateCourrier })} />
      </Grille2>
      {datesModifiees && <ControleDates dateReception={v.dateReception} dateCourrier={v.dateCourrier} valeur={derogation} onChange={setDerogation} />}
      <Grille2>
        <Saisie id="c-expediteur" label="Expéditeur" value={v.expediteur} onChange={(expediteur) => setV({ ...v, expediteur })} required maxLength={300} />
        <Saisie id="c-reference" label="Référence de l’expéditeur" facultatif value={v.referenceExpediteur} onChange={(referenceExpediteur) => setV({ ...v, referenceExpediteur })} maxLength={120} />
      </Grille2>
      {!personnel && arrivee.niveau !== 'EXISTENCE' && <ZoneTexte id="c-objet" label="Objet" value={v.objet} onChange={(objet) => setV({ ...v, objet })} maxLength={500} lignes={2} />}
      <MentionInterim />
    </FenetreFormulaire>
  );
}

// ---------------------------------------------------------------------------
// Pli personnel — destinataire seul
// ---------------------------------------------------------------------------

export function FenetreCompleterPli({ arrivee, onClose, onFait }: { arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [objet, setObjet] = useState(arrivee.objet ?? '');
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Compléter le pli"
      sousTitre="L’objet reste visible de vous seul tant que le pli est personnel."
      libelleValider="Enregistrer"
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      valider={() => (objet.trim().length === 1 ? { 'p-objet': 'Indiquez au moins 2 caractères.' } : {})}
      onSubmit={async () => {
        const r = await envoyer(() => completerPli(arrivee.id, objet.trim()));
        if (!r.ok) return;
        toast.succes('Pli complété', { detail: `Courrier ${arrivee.numero}.` });
        onFait();
      }}
    >
      <ZoneTexte id="p-objet" label="Objet" value={objet} onChange={setObjet} required maxLength={500} lignes={3} messageObligatoire="Indiquez l’objet du pli." />
      <MentionInterim />
    </FenetreFormulaire>
  );
}

export function FenetreRequalifier({ arrivee, onClose, onFait }: { arrivee: Arrivee; onClose: () => void; onFait: () => void }) {
  const toast = useToast();
  const [cible, setCible] = useState<'ORDINAIRE' | 'CONFIDENTIEL'>('CONFIDENTIEL');
  const [confirme, setConfirme] = useState(false);
  const { enCours, erreur, envoyer } = useEnvoi();
  return (
    <FenetreFormulaire
      titre="Requalifier le pli"
      sousTitre="Le pli entre dans le circuit normal du courrier pour être imputé. C’est définitif : il ne pourra plus redevenir personnel."
      libelleValider="Requalifier définitivement"
      danger
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      onClose={onClose}
      valider={() => (confirme ? {} : { 'r-confirme': 'Cochez la confirmation : la requalification est définitive.' })}
      onSubmit={async () => {
        const r = await envoyer(() => requalifierPli(arrivee.id, cible));
        if (!r.ok) return;
        toast.succes('Pli requalifié', { detail: `Courrier ${arrivee.numero} : ${cible === 'CONFIDENTIEL' ? 'confidentiel' : 'ordinaire'}, à imputer.` });
        onFait();
      }}
    >
      {!arrivee.objet && <p className="mb-3 text-[12.5px] text-clay">Complétez d’abord l’objet du pli.</p>}
      <ChoixSegment<'ORDINAIRE' | 'CONFIDENTIEL'>
        id="r-cible"
        label="Nouvelle confidentialité"
        value={cible}
        onChange={setCible}
        options={[
          { value: 'CONFIDENTIEL', label: 'Confidentiel' },
          { value: 'ORDINAIRE', label: 'Ordinaire' },
        ]}
      />
      <Case id="r-confirme" label="Je comprends que le pli ne sera plus personnel et que ce choix est définitif." checked={confirme} onChange={setConfirme} />
      <div className="-mt-2 mb-3">
        <MessageErreurChamp id="r-confirme" />
      </div>
      <MentionInterim />
    </FenetreFormulaire>
  );
}

// ---------------------------------------------------------------------------
// Imputation dans la fenêtre du courrier (refonte de l'interface, étapes 5 et 9)
// ---------------------------------------------------------------------------

export const ID_FORMULAIRE_IMPUTER = 'formulaire-imputer';

/**
 * « Imputer ce courrier » directement dans la fenêtre : mêmes appels que FenetreImputer
 * (GET /courrier/imputables, imputer ou sous-imputer), puis, si la case est cochée, la
 * conversion en tâche existante (l'imputant en est l'auteur). La case « Ajouter une
 * sous-imputation » n'apparaît que si la personne a elle-même reçu une imputation qu'elle peut
 * sous-imputer (droits de l'API). Le bouton qui envoie est l'action principale de la colonne
 * de droite (attribut `form`). Les champs sont vérifiés avant l'envoi (message sous le champ,
 * rien n'est envoyé) ; un refus de l'API s'affiche en français sous le formulaire.
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
  const toast = useToast();
  const { user } = useAuth();
  const [sous, setSous] = useState(false);
  const parent = sous ? sousImputable : null;
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [imputeAId, setImputeAId] = useState('');
  const [nature, setNature] = useState<ImputationNature>('ATTRIBUTION');
  const [instructions, setInstructions] = useState('');
  const [echeance, setEcheance] = useState('');
  const [tache, setTache] = useState(false);
  const [erreurs, setErreurs] = useState<{ a?: string; echeance?: string }>({});
  const { enCours, erreur, setErreur, envoyer } = useEnvoi();
  useEffect(() => onEnCours?.(enCours), [enCours, onEnCours]);

  useEffect(() => {
    setCandidats(null);
    setImputeAId('');
    setErreurs({});
    if (parent?.echeance) setEcheance(versJour(parent.echeance));
    getImputables(parent ? { imputationId: parent.id } : { arriveeId: arrivee.id })
      .then(setCandidats)
      .catch((e) => {
        setCandidats([]);
        setErreur(messageErreur(e, 'Les personnes à qui imputer n’ont pas pu être lues. Réessayez dans un instant.'));
      });
  }, [arrivee.id, parent, setErreur]);
  const personnes = (candidats ?? []).map((c) => versPersonne(c));
  const echeanceObligatoire = !!parent?.echeance || tache;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const nouvelles = {
      ...(!imputeAId ? { a: personnes.length === 0 ? 'Personne ne peut recevoir ce courrier de votre part.' : 'Choisissez un destinataire.' } : {}),
      ...(!echeance && echeanceObligatoire ? { echeance: tache ? 'Indiquez l’échéance : elle sera celle de la tâche de suivi.' : 'Indiquez l’échéance (au plus tard la vôtre).' } : {}),
    };
    setErreurs(nouvelles);
    setErreur(null);
    // Personne manquante : le champ est montré sans y entrer (le focus ouvrirait la liste et masquerait le message).
    if (nouvelles.a) return document.getElementById('imp-a')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (nouvelles.echeance) return document.getElementById('imp-echeance')?.focus();
    const input = { imputeAId, nature, instructions: instructions.trim() || undefined, echeance: echeance ? finDeJourIso(echeance) : undefined };
    const r = await envoyer(() => (parent ? sousImputer(parent.id, input) : imputer(arrivee.id, input)));
    if (!r.ok) return;
    const qui = nomDe(personnes, imputeAId);
    if (tache) {
      const t = await envoyer(() => convertirEnTache(r.valeur.id, { dueDate: finDeJourIso(echeance) }));
      if (!t.ok) {
        toast.erreur('Courrier imputé, tâche non créée', 'Utilisez « Convertir en tâche » sur l’imputation.');
        return onFait('Courrier imputé, mais la tâche de suivi n’a pas pu être créée : utilisez « Convertir en tâche » sur l’imputation.');
      }
    }
    toast.succes(parent ? 'Courrier sous-imputé' : 'Courrier imputé', {
      detail: `${imputeAId === user?.id ? 'À vous-même' : `${qui} a été prévenu(e)`}${tache ? ', tâche de suivi créée' : ''}.`,
    });
    onFait();
  }

  return (
    <form
      id={ID_FORMULAIRE_IMPUTER}
      noValidate
      onSubmit={soumettre}
      onKeyDown={(e) => {
        // Échap ferme d'abord la liste des personnes ou le calendrier ouverts, pas la fenêtre du courrier.
        if (e.key === 'Escape' && e.currentTarget.querySelector('[role=listbox], [aria-label="Choisir une date"]')) e.nativeEvent.stopPropagation();
      }}
      aria-label={parent ? 'Sous-imputer ce courrier' : 'Imputer ce courrier'} data-testid="formulaire-imputer" className="mb-[18px]">
      <h3 className="mb-2 text-[13px] font-bold text-ink-900">{parent ? 'Sous-imputer ce courrier' : 'Imputer ce courrier'}</h3>
      {parent && (
        <p className="mb-2 text-[12.5px] text-text-muted">
          Au sein de votre périmètre{parent.echeance ? `, au plus tard pour le ${formatDate(parent.echeance)} (votre échéance)` : ''}.
        </p>
      )}
      {candidats === null ? (
        <SqueletteChamps champs={2} />
      ) : (
        <>
          <div className="grid gap-x-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className={erreurs.a ? '[&_.min-h-10]:!border-clay' : ''}>
              <SelecteurPersonnes
                id="imp-a"
                label="À"
                options={personnes}
                valeurs={imputeAId ? [imputeAId] : []}
                onChange={(ids) => {
                  setImputeAId(ids[0] ?? '');
                  setErreurs((x) => ({ ...x, a: undefined }));
                }}
                multiple={false}
                placeholder={personnes.length === 0 ? 'Personne à qui imputer' : 'Rechercher une personne…'}
              />
              <ErreurSousChamp id="imp-a" message={erreurs.a ?? null} />
            </div>
            <div className={erreurs.echeance ? '[&_input[type=text]]:!border-clay' : ''}>
              <ChampDate
                id="imp-echeance"
                label="Échéance de traitement"
                facultatif={!echeanceObligatoire}
                value={echeance}
                onChange={(v) => {
                  setEcheance(v);
                  setErreurs((x) => ({ ...x, echeance: undefined }));
                }}
                min={aujourdhui()}
                max={parent?.echeance ? versJour(parent.echeance) : undefined}
              />
              <ErreurSousChamp id="imp-echeance" message={erreurs.echeance ?? null} />
            </div>
          </div>
          <ChoixSegment<ImputationNature> id="imp-nature" label="Nature" value={nature} onChange={setNature} options={NATURES} />
          <ZoneTexte id="imp-instruction" label="Instruction" facultatif value={instructions} onChange={setInstructions} maxLength={2000} lignes={2} placeholder="Préparer une note, proposer des agents…" />
          <Case id="imp-tache" label="Créer aussi une tâche pour le suivi" checked={tache} onChange={(v) => (setTache(v), setErreurs((x) => ({ ...x, echeance: undefined })))} />
          {sousImputable && <Case id="imp-sous" label="Ajouter une sous-imputation" checked={sous} onChange={setSous} />}
        </>
      )}
      {erreur && (
        <p role="alert" data-testid="erreur-formulaire" className="mb-3 rounded-[9px] border border-clay-bord bg-clay-50 px-3 py-2.5 text-[13px] font-semibold text-clay">
          {erreur}
        </p>
      )}
      <MentionInterim />
    </form>
  );
}
