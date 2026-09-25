'use client';

import { useState } from 'react';
import { importerPersonnel } from '../../lib/api/personnel';
import type { RapportImport } from '../../lib/personnel/types';
import { Erreur, Fenetre, Libelle } from '../courrier/ui';
import { Button } from '../ui/Button';

const COLONNES =
  'Email, Prénom, Nom, Rôle, Division, Section, Cellule, Statut d’emploi, Grade, Échelon, Date de prise de service, Téléphone personnel, Adresse personnelle, Email personnel, Contact urgence nom / lien / téléphone';

/** Import Excel (DRH) : envoi du fichier, puis rapport ligne par ligne tel que
 * renvoyé par l'API. */
export function FenetreImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    if (!fichier) return;
    setEnCours(true);
    setErreur(null);
    try {
      setRapport(await importerPersonnel(fichier));
      onImported();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setEnCours(false);
    }
  }

  if (rapport) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,38,0.42)] sm:items-center sm:p-4" onClick={onClose}>
        <div
          role="dialog"
          aria-label="Rapport d’import"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-surface p-5 sm:max-w-[620px] sm:rounded-lg sm:p-6"
        >
          <h2 className="mb-1.5 text-[18px] font-semibold">Rapport d’import</h2>
          <p className="mb-3 text-[13px] text-text-muted" data-testid="bilan-import">
            {rapport.total} ligne{rapport.total > 1 ? 's' : ''} : {rapport.created} compte{rapport.created > 1 ? 's' : ''} créé
            {rapport.created > 1 ? 's' : ''}, {rapport.updated} dossier{rapport.updated > 1 ? 's' : ''} mis à jour, {rapport.errors} erreur
            {rapport.errors > 1 ? 's' : ''}.
          </p>
          <ul className="mb-4 space-y-1.5 text-[12.5px]">
            {rapport.details.map((d) => (
              <li key={d.row} className={`rounded-md px-3 py-2 ${d.status === 'error' ? 'bg-clay-soft text-clay' : 'bg-bg'}`}>
                <strong>Ligne {d.row}</strong>
                {d.email ? ` (${d.email})` : ''} — {d.message}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button variant="gold" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Fenetre
      titre="Importer le personnel (Excel)"
      sousTitre="Une ligne par personne. Adresse inconnue : un compte de Chargé d’Études est créé (les autres rôles s’attribuent ensuite par l’administrateur système). Adresse connue : seul le dossier est mis à jour."
      onClose={onClose}
      onSubmit={envoyer}
      valider="Importer"
      enCours={enCours}
    >
      <Libelle htmlFor="import-fichier">Fichier .xlsx</Libelle>
      <input
        id="import-fichier"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="mb-3 block w-full text-[13px]"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        required
      />
      <p className="mb-4 text-[11.5px] text-text-faint">Colonnes reconnues (première ligne) : {COLONNES}.</p>
      <Erreur message={erreur} />
    </Fenetre>
  );
}
