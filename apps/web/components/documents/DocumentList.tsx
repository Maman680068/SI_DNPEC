'use client';

import type { ReactNode } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import type { DnpecDocument, Folder } from '../../lib/documents/types';
import { STATUT_LABEL, STATUT_PASTILLE, TYPE_DOCUMENT_LABEL } from '../../lib/documents/types';
import { cheminDossier, dateRelative, periodeCourte } from '../../lib/documents/affichage';
import { IconeFichier, LigneTableau, MarqueFinal, Pastille, Tableau } from '../ui/Charte';

const GRILLE = 'lg:grid-cols-[minmax(0,1fr)_110px_112px_152px_40px_112px]';

/**
 * Tableau des documents (maquette « Archives ») : icône du type de fichier, titre et chemin du
 * dossier · date, type, période couverte, statut (et marque Final), version, auteur ; la ligne ouvre
 * la fenêtre du document. `pied` : zone de dépôt par glisser-déposer.
 */
export function DocumentList({
  documents,
  dossiers,
  onSelect,
  vide,
  pied,
}: {
  documents: DnpecDocument[];
  dossiers: Folder[];
  onSelect: (doc: DnpecDocument) => void;
  vide: ReactNode;
  pied?: ReactNode;
}) {
  const { getUserLabel, getDivisionName, getCelluleName } = useOrg();

  const sousLigne = (doc: DnpecDocument) => {
    const chemin = cheminDossier(doc.folderId, dossiers).map((f) => f.name);
    const lieu = chemin.length ? chemin.join(' › ') : doc.visibility === 'PUBLIE_DNPEC' ? (doc.divisionId ? getDivisionName(doc.divisionId) : getCelluleName(doc.celluleId)) : null;
    const quand = doc.visibility === 'PUBLIE_DNPEC' && doc.publishedAt ? `publié ${/^\d/.test(dateRelative(doc.publishedAt)) ? 'le ' : ''}${dateRelative(doc.publishedAt)}` : dateRelative(doc.createdAt);
    return [lieu, quand].filter(Boolean).join(' · ');
  };

  return (
    <Tableau label="Documents" colonnes={['Document', 'Type', 'Période couverte', 'Statut', 'Version', 'Auteur']} grille={GRILLE} vide={vide} pied={pied} testid="liste-documents">
        {documents.map((doc) => (
          <LigneTableau key={doc.id} grille={GRILLE} onClick={() => onSelect(doc)} label={doc.title} testid="ligne-document">
            <span className="flex min-w-0 items-center gap-[11px]">
              <IconeFichier nom={doc.currentVersion?.fileName ?? ''} grand />
              <span className="min-w-0">
                <b className="block truncate font-semibold text-text">{doc.title}</b>
                <small className="block truncate text-[12px] text-text-muted">{sousLigne(doc)}</small>
              </span>
            </span>
            <span className="text-[12.5px] text-text-muted">
              <span className="lg:hidden">Type : </span>
              {TYPE_DOCUMENT_LABEL[doc.typeDocument]}
            </span>
            <span className={`text-[12.5px] ${doc.periodeDebut ? 'text-text-muted' : 'font-semibold text-clay'}`}>
              <span className="font-normal text-text-muted lg:hidden">Période : </span>
              {periodeCourte(doc.periodeDebut, doc.periodeFin)}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <Pastille ton={STATUT_PASTILLE[doc.statutDiffusion]}>{STATUT_LABEL[doc.statutDiffusion]}</Pastille>
              {doc.isFinal && <MarqueFinal />}
            </span>
            <span className="text-[12.5px] text-text-muted">
              <span className="lg:hidden">Version </span>v{doc.currentVersion?.versionNumber ?? 1}
            </span>
            <span className="block truncate text-[12.5px] text-text-muted">
              <span className="lg:hidden">Auteur : </span>
              {getUserLabel(doc.createdById)}
            </span>
          </LigneTableau>
        ))}
    </Tableau>
  );
}
