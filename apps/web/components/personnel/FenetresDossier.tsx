'use client';

import { useEffect, useState } from 'react';
import {
  ajouterDiplome,
  ajouterPiece,
  deposerFicheDePoste,
  modifierNiveauDeux,
  modifierNiveauUn,
  signalerErreur,
  type NiveauUnInput,
} from '../../lib/api/personnel';
import type { DossierPersonnel, EmploymentStatus, NiveauDeux } from '../../lib/personnel/types';
import { EMPLOYMENT_STATUS_LABEL } from '../../lib/personnel/types';
import { getPiecesRequises } from '../../lib/api/rh';
import type { PieceRequise } from '../../lib/rh/types';
import { ChampDate, FenetreFormulaire, Grille2, Liste, Saisie, ZoneDepot, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

type Props = { dossier: DossierPersonnel; onClose: () => void; onDone: () => void };

/** Exécute une écriture et affiche le refus de l'API en bas de la fenêtre. */
function useEnvoi(onDone: () => void) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function envoyer(fn: () => Promise<unknown>, defaut: string) {
    setEnCours(true);
    setErreur(null);
    try {
      await fn();
      onDone();
    } catch (err) {
      setErreur(messageErreur(err, defaut));
    } finally {
      setEnCours(false);
    }
  }
  return { enCours, erreur, envoyer };
}

/** Seuls les champs modifiés sont envoyés : l'API repasse « à vérifier »
 * chaque champ reçu. */
export function FenetreNiveauUn({ dossier, onClose, onDone }: Props) {
  const b = dossier.basic;
  const initial = {
    employmentStatus: b.employmentStatus ?? '',
    grade: b.grade ?? '',
    echelon: b.echelon ?? '',
    categorie: b.categorie ?? '',
    echelonDepuis: b.echelonDepuis ? b.echelonDepuis.slice(0, 10) : '',
    serviceStartDate: b.serviceStartDate ? b.serviceStartDate.slice(0, 10) : '',
  };
  const [v, setV] = useState(initial);
  const [fiche, setFiche] = useState<File[]>([]);
  const { enCours, erreur, envoyer } = useEnvoi(onDone);
  const set = (k: keyof typeof initial) => (x: string) => setV((o) => ({ ...o, [k]: x }));

  function valider() {
    const input: NiveauUnInput = {};
    if (v.employmentStatus && v.employmentStatus !== initial.employmentStatus) input.employmentStatus = v.employmentStatus as EmploymentStatus;
    if (v.grade.trim() && v.grade.trim() !== initial.grade) input.grade = v.grade.trim();
    if (v.echelon.trim() && v.echelon.trim() !== initial.echelon) input.echelon = v.echelon.trim();
    if (v.serviceStartDate && v.serviceStartDate !== initial.serviceStartDate) input.serviceStartDate = v.serviceStartDate;
    if (v.categorie.trim() && v.categorie.trim() !== initial.categorie) input.categorie = v.categorie.trim();
    if (v.echelonDepuis && v.echelonDepuis !== initial.echelonDepuis) input.echelonDepuis = v.echelonDepuis;
    return envoyer(async () => {
      if (Object.keys(input).length > 0) await modifierNiveauUn(dossier.userId, input);
      if (fiche[0]) await deposerFicheDePoste(dossier.userId, fiche[0]);
    }, 'Enregistrement impossible');
  }

  return (
    <FenetreFormulaire
      titre="Situation administrative"
      sousTitre={`${dossier.identite.firstName} ${dossier.identite.lastName}`}
      onClose={onClose}
      onSubmit={valider}
      libelleValider="Enregistrer"
      enCours={enCours}
      erreur={erreur}
      pied="Chaque champ modifié repasse « à vérifier » jusqu’à confirmation par la personne."
      testid="fenetre-niveau-1"
    >
      <Grille2>
        <Liste
          id="n1-statut"
          label="Statut d’emploi"
          vide="—"
          value={v.employmentStatus}
          onChange={set('employmentStatus')}
          options={(Object.keys(EMPLOYMENT_STATUS_LABEL) as EmploymentStatus[]).map((s) => ({ value: s, label: EMPLOYMENT_STATUS_LABEL[s] }))}
        />
        <Saisie id="n1-categorie" label="Catégorie (A, B, C, D…)" value={v.categorie} onChange={set('categorie')} maxLength={20} />
        <Saisie id="n1-grade" label="Grade" value={v.grade} onChange={set('grade')} maxLength={100} />
        <Saisie id="n1-echelon" label="Échelon" value={v.echelon} onChange={set('echelon')} maxLength={50} />
        <ChampDate id="n1-echelon-depuis" label="Dans cet échelon depuis le" value={v.echelonDepuis} onChange={set('echelonDepuis')} raccourcis={false} />
        <ChampDate id="n1-date" label="Date de prise de service" value={v.serviceStartDate} onChange={set('serviceStartDate')} raccourcis={false} />
      </Grille2>
      <ZoneDepot
        id="n1-fiche"
        label={`Fiche de poste${dossier.basic.jobDescriptionFileName ? ' (remplace l’actuelle)' : ''}`}
        facultatif
        fichiers={fiche}
        onChange={setFiche}
      />
    </FenetreFormulaire>
  );
}

export function FenetreNiveauDeux({ dossier, onClose, onDone }: Props) {
  const s = dossier.sensitive as NiveauDeux;
  const initial = {
    personalAddress: s.personalAddress ?? '',
    personalPhone: s.personalPhone ?? '',
    personalEmail: s.personalEmail ?? '',
    emergencyContactName: s.emergencyContactName ?? '',
    emergencyContactRelation: s.emergencyContactRelation ?? '',
    emergencyContactPhone: s.emergencyContactPhone ?? '',
  };
  const [v, setV] = useState(initial);
  const { enCours, erreur, envoyer } = useEnvoi(onDone);
  const set = (k: keyof typeof initial) => (x: string) => setV((o) => ({ ...o, [k]: x }));

  function valider() {
    const input: Partial<NiveauDeux> = {};
    for (const k of Object.keys(initial) as (keyof typeof initial)[]) {
      if (v[k].trim() && v[k].trim() !== initial[k]) input[k] = v[k].trim();
    }
    return envoyer(async () => {
      if (Object.keys(input).length > 0) await modifierNiveauDeux(dossier.userId, input);
    }, 'Enregistrement impossible');
  }

  return (
    <FenetreFormulaire
      titre="Informations personnelles"
      sousTitre="Réservées à la personne et au DRH."
      onClose={onClose}
      onSubmit={valider}
      libelleValider="Enregistrer"
      enCours={enCours}
      erreur={erreur}
      pied="Chaque champ modifié repasse « à vérifier » jusqu’à confirmation par la personne."
      testid="fenetre-niveau-2"
    >
      <Saisie id="n2-adresse" label="Adresse personnelle" value={v.personalAddress} onChange={set('personalAddress')} maxLength={300} />
      <Grille2>
        <Saisie id="n2-tel" label="Téléphone personnel" type="tel" value={v.personalPhone} onChange={set('personalPhone')} maxLength={30} />
        <Saisie id="n2-email" label="Email personnel" type="email" value={v.personalEmail} onChange={set('personalEmail')} />
      </Grille2>
      <Grille2>
        <Saisie id="n2-urg-nom" label="Contact d’urgence — nom" value={v.emergencyContactName} onChange={set('emergencyContactName')} maxLength={150} />
        <Saisie id="n2-urg-lien" label="Contact d’urgence — lien" value={v.emergencyContactRelation} onChange={set('emergencyContactRelation')} maxLength={100} />
        <Saisie id="n2-urg-tel" label="Contact d’urgence — téléphone" type="tel" value={v.emergencyContactPhone} onChange={set('emergencyContactPhone')} maxLength={30} />
      </Grille2>
    </FenetreFormulaire>
  );
}

export function FenetreDiplome({ dossier, onClose, onDone }: Props) {
  const [titre, setTitre] = useState('');
  const [etablissement, setEtablissement] = useState('');
  const [annee, setAnnee] = useState('');
  const [fichier, setFichier] = useState<File[]>([]);
  const { enCours, erreur, envoyer } = useEnvoi(onDone);
  const anneeMax = new Date().getFullYear();
  return (
    <FenetreFormulaire
      titre="Ajouter un diplôme"
      sousTitre={`${dossier.identite.firstName} ${dossier.identite.lastName}`}
      onClose={onClose}
      largeur={640}
      onSubmit={() =>
        envoyer(
          () => ajouterDiplome(dossier.userId, { title: titre.trim(), institution: etablissement.trim() || undefined, obtainedYear: annee ? Number(annee) : undefined }, fichier[0] ?? null),
          'Ajout impossible',
        )
      }
      libelleValider="Ajouter le diplôme"
      enCours={enCours}
      erreur={erreur}
      pied="Le diplôme reste « à vérifier » jusqu’à confirmation."
    >
      <Saisie id="dip-titre" label="Intitulé" required value={titre} onChange={setTitre} maxLength={200} placeholder="Ex. : Master en économie" />
      <Grille2>
        <Saisie id="dip-etab" label="Établissement" facultatif value={etablissement} onChange={setEtablissement} maxLength={200} />
        <Saisie id="dip-annee" label="Année d’obtention" facultatif type="number" min={1950} max={anneeMax} value={annee} onChange={setAnnee} />
      </Grille2>
      <ZoneDepot id="dip-fichier" label="Justificatif" facultatif fichiers={fichier} onChange={setFichier} />
    </FenetreFormulaire>
  );
}

export function FenetrePiece({ dossier, onClose, onDone }: Props) {
  const [libelle, setLibelle] = useState('');
  const [pieceRequiseId, setPieceRequiseId] = useState('');
  const [requises, setRequises] = useState<PieceRequise[]>([]);
  const [fichier, setFichier] = useState<File[]>([]);
  const { enCours, erreur, envoyer } = useEnvoi(onDone);
  useEffect(() => {
    // Socle N6 : une pièce peut fournir une pièce de la liste des pièces requises (dossier complet).
    getPiecesRequises().then((l) => setRequises(l.pieces.filter((p) => p.actif))).catch(() => setRequises([]));
  }, []);
  return (
    <FenetreFormulaire
      titre="Ajouter une pièce administrative"
      sousTitre={`${dossier.identite.firstName} ${dossier.identite.lastName}`}
      onClose={onClose}
      largeur={640}
      onSubmit={() => envoyer(() => ajouterPiece(dossier.userId, libelle.trim(), fichier[0]!, pieceRequiseId || undefined), 'Ajout impossible')}
      libelleValider="Ajouter la pièce"
      enCours={enCours}
      erreur={erreur}
      pied="Une pièce requise fournie complète le dossier."
    >
      {requises.length > 0 && (
        <Liste
          id="piece-requise"
          label="Pièce requise fournie"
          facultatif
          vide="— Autre pièce —"
          value={pieceRequiseId}
          onChange={(x) => {
            setPieceRequiseId(x);
            const p = requises.find((r) => r.id === x);
            if (p && !libelle.trim()) setLibelle(p.libelle);
          }}
          options={requises.map((p) => ({ value: p.id, label: p.libelle }))}
        />
      )}
      <Saisie id="piece-libelle" label="Libellé" required value={libelle} onChange={setLibelle} maxLength={150} />
      <ZoneDepot id="piece-fichier" label="Fichier" required fichiers={fichier} onChange={setFichier} />
    </FenetreFormulaire>
  );
}

const CHAMPS_SIGNALABLES: string[] = [
  'Statut d’emploi',
  'Grade',
  'Échelon',
  'Date de prise de service',
  'Fiche de poste',
  'Adresse personnelle',
  'Téléphone personnel',
  'Email personnel',
  'Contact d’urgence',
  'Diplômes',
  'Pièces administratives',
  'Historique de carrière',
  'Autre',
];

export function FenetreSignaler({ dossier, onClose, onDone }: Props) {
  const [champ, setChamp] = useState('Statut d’emploi');
  const [commentaire, setCommentaire] = useState('');
  const { enCours, erreur, envoyer } = useEnvoi(onDone);
  return (
    <FenetreFormulaire
      titre="Signaler une erreur"
      sousTitre="Dans votre dossier du personnel"
      onClose={onClose}
      largeur={600}
      onSubmit={() => envoyer(() => signalerErreur(dossier.userId, champ, commentaire.trim()), 'Signalement impossible')}
      libelleValider="Envoyer au DRH"
      enCours={enCours}
      erreur={erreur}
      pied="Le DRH est prévenu et corrige le dossier."
    >
      <Liste id="sig-champ" label="Information concernée" value={champ} onChange={setChamp} options={CHAMPS_SIGNALABLES.map((c) => ({ value: c, label: c }))} />
      <ZoneTexte id="sig-commentaire" label="Ce qui est inexact" required messageObligatoire="Décrivez ce qui est inexact." value={commentaire} onChange={setCommentaire} maxLength={2000} lignes={4} />
    </FenetreFormulaire>
  );
}
