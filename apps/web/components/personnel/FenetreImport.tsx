'use client';

import { useState } from 'react';
import { importerPersonnel } from '../../lib/api/personnel';
import type { RapportImport } from '../../lib/personnel/types';
import { FenetreFormulaire, ZoneDepot } from '../ui/Formulaire';
import { messageErreur, useToast } from '../ui/Toast';

const COLONNES =
  'Email, Prénom, Nom, Rôle, Division, Section, Cellule, Statut d’emploi, Grade, Échelon, Date de prise de service, Téléphone personnel, Adresse personnelle, Email personnel, Contact urgence nom / lien / téléphone';

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Import Excel (DRH) : envoi du fichier, puis rapport ligne par ligne tel que
 * renvoyé par l'API. */
export function FenetreImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [fichier, setFichier] = useState<File[]>([]);
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const toast = useToast();

  async function envoyer() {
    if (!fichier[0]) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await importerPersonnel(fichier[0]);
      setRapport(r);
      onImported();
      toast.succes('Import terminé', { detail: `${pluriel(r.created, 'compte')} créé${r.created > 1 ? 's' : ''}, ${pluriel(r.updated, 'dossier')} mis à jour, ${pluriel(r.errors, 'erreur')}.` });
    } catch (err) {
      setErreur(messageErreur(err, 'Import impossible'));
    } finally {
      setEnCours(false);
    }
  }

  if (rapport) {
    return (
      <FenetreFormulaire titre="Rapport d’import" onClose={onClose} largeur={680} pied="Les comptes créés reçoivent un lien de premier accès valable 7 jours.">
        <p className="mb-3 text-[13px] text-text-muted" data-testid="bilan-import">
          {rapport.total} ligne{rapport.total > 1 ? 's' : ''} : {rapport.created} compte{rapport.created > 1 ? 's' : ''} créé
          {rapport.created > 1 ? 's' : ''}, {rapport.updated} dossier{rapport.updated > 1 ? 's' : ''} mis à jour, {rapport.errors} erreur
          {rapport.errors > 1 ? 's' : ''}.
        </p>
        <ul className="space-y-1.5 text-[12.5px]">
          {rapport.details.map((d) => (
            <li key={d.row} className={`rounded-md px-3 py-2 ${d.status === 'error' ? 'bg-clay-soft text-clay' : 'bg-bg'}`}>
              <strong>Ligne {d.row}</strong>
              {d.email ? ` (${d.email})` : ''} — {d.message}
            </li>
          ))}
        </ul>
      </FenetreFormulaire>
    );
  }

  return (
    <FenetreFormulaire
      titre="Importer le personnel (Excel)"
      sousTitre="Une ligne par personne."
      onClose={onClose}
      onSubmit={envoyer}
      largeur={680}
      libelleValider="Importer"
      enCours={enCours}
      erreur={erreur}
      pied="Adresse connue : seul le dossier est mis à jour. Un rapport ligne par ligne s’affiche ensuite."
    >
      <p className="mb-3.5 text-[13px] text-text">
        Adresse inconnue : un compte est créé — Chargé d’Études, ou Stagiaire si la colonne Rôle l’indique (les autres rôles s’attribuent ensuite par l’administrateur système).
      </p>
      <ZoneDepot
        id="import-fichier"
        label="Fichier .xlsx"
        required
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aide="Classeur Excel (.xlsx) · 25 Mo au plus"
        fichiers={fichier}
        onChange={setFichier}
      />
      <p className="text-[12px] text-text-muted">Colonnes reconnues (première ligne) : {COLONNES}.</p>
    </FenetreFormulaire>
  );
}
