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
import { Erreur, Fenetre, Libelle, SELECT_CLASS, TEXTAREA_CLASS, messageErreur } from './ui';

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
  const { enCours, erreur, envoyer } = useEnvoi();
  const personnel = arrivee.confidentialite === 'PERSONNEL';
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
