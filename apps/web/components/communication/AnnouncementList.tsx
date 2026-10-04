'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Announcement } from '../../lib/communication/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { EtatVide, LigneTableau, Pastille, Tableau, type TonPastille } from '../ui/Charte';
import type { ReactNode } from 'react';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export const TON_PORTEE: Record<Announcement['scope'], TonPastille> = {
  DNPEC: 'rouge',
  DIVISION: 'encre',
  SECTION: 'encre',
  CELLULE: 'ambre',
  GROUPE_PERSONNALISE: 'gris',
};

const GRILLE = 'lg:grid-cols-[minmax(0,1fr)_170px_180px_110px]';

/** Annonces en tableau compact (refonte : titre et extrait, portée, auteur, date ; clic = fenêtre). */
export function AnnouncementList({ announcements, onSelect, vide }: { announcements: Announcement[]; onSelect: (id: string) => void; vide?: ReactNode }) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  return (
    <Tableau label="Annonces" grille={GRILLE} colonnes={['Annonce', 'Portée', 'Auteur', 'Date']} testid="annonces" vide={<EtatVide texte="Aucune annonce pour l’instant." action={vide} />}>
      {announcements.map((a) => (
        <LigneTableau key={a.id} grille={GRILLE} onClick={() => onSelect(a.id)} label={a.title} testid="annonce">
          <span className="block min-w-0">
            <b className="block truncate font-semibold text-text">{a.title}</b>
            <span className="block truncate text-[12.5px] text-text-muted">{a.body}</span>
          </span>
          <Pastille ton={TON_PORTEE[a.scope]}>{SCOPE_LABEL[a.scope]}</Pastille>
          <span className="block truncate text-[13px]">{a.authorId === currentUser?.id ? 'Vous' : getUserLabel(a.authorId)}</span>
          <span className="text-[12.5px] text-text-muted">{formatDate(a.createdAt)}</span>
        </LigneTableau>
      ))}
    </Tableau>
  );
}
