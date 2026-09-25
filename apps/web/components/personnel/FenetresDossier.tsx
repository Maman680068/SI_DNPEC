'use client';

import { useState } from 'react';
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
import { Erreur, Fenetre, Libelle, SELECT_CLASS, TEXTAREA_CLASS, messageErreur } from '../courrier/ui';

type Props = { dossier: DossierPersonnel; onClose: () => void; onDone: () => void };

/** Exécute une écriture et affiche le refus de l'API tel quel. */
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

function Champ({ id, label, value, onChange, type = 'text', maxLength }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; maxLength?: number }) {
  return (
    <div className="mb-3.5">
      <Libelle htmlFor={id}>{label}</Libelle>
      <input id={id} type={type} className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} />
    </div>
  );
}

/** Seuls les champs modifiés sont envoyés : l'API repasse « à vérifier »
 * chaque champ reçu. */
export function FenetreNiveauUn({ dossier, onClose, onDone }: Props) {
  const b = dossier.basic;
  const initial = {
    employmentStatus: b.employmentStatus ?? '',
    grade: b.grade ?? '',
    echelon: b.echelon ?? '',
    serviceStartDate: b.serviceStartDate ? b.serviceStartDate.slice(0, 10) : '',
  };
  const [v, setV] = useState(initial);
  const [fiche, setFiche] = useState<File | null>(null);
  const { enCours, erreur, envoyer } = useEnvoi(onDone);

  function valider() {
    const input: NiveauUnInput = {};
    if (v.employmentStatus && v.employmentStatus !== initial.employmentStatus) input.employmentStatus = v.employmentStatus as EmploymentStatus;
    if (v.grade.trim() && v.grade.trim() !== initial.grade) input.grade = v.grade.trim();
    if (v.echelon.trim() && v.echelon.trim() !== initial.echelon) input.echelon = v.echelon.trim();
    if (v.serviceStartDate && v.serviceStartDate !== initial.serviceStartDate) input.serviceStartDate = v.serviceStartDate;
    return envoyer(async () => {
      if (Object.keys(input).length > 0) await modifierNiveauUn(dossier.userId, input);
      if (fiche) await deposerFicheDePoste(dossier.userId, fiche);
    }, 'Enregistrement impossible');
  }

  return (
    <Fenetre titre="Situation administrative" sousTitre="Chaque champ modifié repasse « à vérifier » jusqu’à confirmation par la personne." onClose={onClose} onSubmit={valider} valider="Enregistrer" enCours={enCours}>
      <div className="mb-3.5">
        <Libelle htmlFor="n1-statut">Statut d’emploi</Libelle>
        <select id="n1-statut" className={SELECT_CLASS} value={v.employmentStatus} onChange={(e) => setV({ ...v, employmentStatus: e.target.value })}>
          <option value="">—</option>
          {(Object.keys(EMPLOYMENT_STATUS_LABEL) as EmploymentStatus[]).map((s) => (
            <option key={s} value={s}>
              {EMPLOYMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <Champ id="n1-grade" label="Grade" value={v.grade} onChange={(x) => setV({ ...v, grade: x })} maxLength={100} />
      <Champ id="n1-echelon" label="Échelon" value={v.echelon} onChange={(x) => setV({ ...v, echelon: x })} maxLength={50} />
      <Champ id="n1-date" label="Date de prise de service" type="date" value={v.serviceStartDate} onChange={(x) => setV({ ...v, serviceStartDate: x })} />
      <div className="mb-3.5">
        <Libelle htmlFor="n1-fiche">Fiche de poste {dossier.basic.jobDescriptionFileName ? '(remplace l’actuelle)' : ''}</Libelle>
        <input id="n1-fiche" type="file" className="block w-full text-[13px]" onChange={(e) => setFiche(e.target.files?.[0] ?? null)} />
      </div>
      <Erreur message={erreur} />
    </Fenetre>
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
    <Fenetre titre="Informations personnelles" sousTitre="Réservées à la personne et au DRH." onClose={onClose} onSubmit={valider} valider="Enregistrer" enCours={enCours}>
      <Champ id="n2-adresse" label="Adresse personnelle" value={v.personalAddress} onChange={(x) => setV({ ...v, personalAddress: x })} maxLength={300} />
      <Champ id="n2-tel" label="Téléphone personnel" value={v.personalPhone} onChange={(x) => setV({ ...v, personalPhone: x })} maxLength={30} />
      <Champ id="n2-email" label="Email personnel" type="email" value={v.personalEmail} onChange={(x) => setV({ ...v, personalEmail: x })} />
      <Champ id="n2-urg-nom" label="Contact d’urgence — nom" value={v.emergencyContactName} onChange={(x) => setV({ ...v, emergencyContactName: x })} maxLength={150} />
      <Champ id="n2-urg-lien" label="Contact d’urgence — lien" value={v.emergencyContactRelation} onChange={(x) => setV({ ...v, emergencyContactRelation: x })} maxLength={100} />
      <Champ id="n2-urg-tel" label="Contact d’urgence — téléphone" value={v.emergencyContactPhone} onChange={(x) => setV({ ...v, emergencyContactPhone: x })} maxLength={30} />
      <Erreur message={erreur} />
    </Fenetre>
  );
}

export function FenetreDiplome({ dossier, onClose, onDone }: Props) {
  const [titre, setTitre] = useState('');
  const [etablissement, setEtablissement] = useState('');
  const [annee, setAnnee] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const { enCours, erreur, envoyer } = useEnvoi(onDone);
  return (
    <Fenetre
      titre="Ajouter un diplôme"
      onClose={onClose}
      onSubmit={() =>
        envoyer(
          () => ajouterDiplome(dossier.userId, { title: titre.trim(), institution: etablissement.trim() || undefined, obtainedYear: annee ? Number(annee) : undefined }, fichier),
          'Ajout impossible',
        )
      }
      valider="Ajouter"
      enCours={enCours}
    >
      <Champ id="dip-titre" label="Intitulé" value={titre} onChange={setTitre} maxLength={200} />
      <Champ id="dip-etab" label="Établissement (facultatif)" value={etablissement} onChange={setEtablissement} maxLength={200} />
      <Champ id="dip-annee" label="Année d’obtention (facultatif)" type="number" value={annee} onChange={setAnnee} />
      <div className="mb-3.5">
        <Libelle htmlFor="dip-fichier">Justificatif (facultatif)</Libelle>
        <input id="dip-fichier" type="file" className="block w-full text-[13px]" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
      </div>
      <Erreur message={erreur} />
    </Fenetre>
  );
}

export function FenetrePiece({ dossier, onClose, onDone }: Props) {
  const [libelle, setLibelle] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const { enCours, erreur, envoyer } = useEnvoi(onDone);
  return (
    <Fenetre
      titre="Ajouter une pièce administrative"
      onClose={onClose}
      onSubmit={() => (fichier ? envoyer(() => ajouterPiece(dossier.userId, libelle.trim(), fichier), 'Ajout impossible') : undefined)}
      valider="Ajouter"
      enCours={enCours}
    >
      <Champ id="piece-libelle" label="Libellé" value={libelle} onChange={setLibelle} maxLength={150} />
      <div className="mb-3.5">
        <Libelle htmlFor="piece-fichier">Fichier</Libelle>
        <input id="piece-fichier" type="file" required className="block w-full text-[13px]" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
      </div>
      <Erreur message={erreur} />
    </Fenetre>
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
    <Fenetre
      titre="Signaler une erreur"
      sousTitre="Le DRH est prévenu et corrige le dossier."
      onClose={onClose}
      onSubmit={() => envoyer(() => signalerErreur(dossier.userId, champ, commentaire.trim()), 'Signalement impossible')}
      valider="Envoyer au DRH"
      enCours={enCours}
    >
      <div className="mb-3.5">
        <Libelle htmlFor="sig-champ">Information concernée</Libelle>
        <select id="sig-champ" className={SELECT_CLASS} value={champ} onChange={(e) => setChamp(e.target.value)}>
          {CHAMPS_SIGNALABLES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="mb-3.5">
        <Libelle htmlFor="sig-commentaire">Ce qui est inexact</Libelle>
        <textarea id="sig-commentaire" className={TEXTAREA_CLASS} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} required maxLength={2000} />
      </div>
      <Erreur message={erreur} />
    </Fenetre>
  );
}
