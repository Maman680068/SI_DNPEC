'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Suggestion } from '../../lib/suggestions/types';
import { STATUS_LABEL } from '../../lib/suggestions/types';
import { BTN_LIGNE, BTN_LIGNE_PRINCIPAL, BTN_SECONDAIRE, EtatVide, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { STATUS_TON, formatDate } from './MySuggestionList';

const GRILLE = 'lg:grid-cols-[110px_minmax(0,1fr)_180px_120px_84px]';

/** Boîte de réception de la Direction : une ligne par suggestion, la fenêtre de décision s'ouvre au clic. */
export function SuggestionInboxList({
  suggestions,
  onSelect,
  selectedId,
  filtre,
  onEffacer,
}: {
  suggestions: Suggestion[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
  filtre?: boolean;
  onEffacer?: () => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  const auteur = (s: Suggestion) => (s.isAnonymous ? 'Anonyme' : s.authorId === currentUser?.id ? 'Vous' : getUserLabel(s.authorId ?? ''));

  return (
    <Tableau
      label="Boîte de réception"
      testid="boite-suggestions"
      grille={GRILLE}
      colonnes={['Reçue le', 'Suggestion', 'Auteur', 'Statut', <span key="a" className="sr-only">Action</span>]}
      vide={
        filtre ? (
          <EtatVide texte="Aucune suggestion ne correspond aux filtres." action={onEffacer ? <button type="button" className={BTN_SECONDAIRE} onClick={onEffacer}>Effacer les filtres</button> : undefined} />
        ) : (
          <EtatVide texte="Aucune suggestion pour l’instant : le personnel peut en déposer, anonymement ou non." />
        )
      }
      pied={suggestions.length > 0 ? <span>{suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} · ouvrez une ligne pour changer le statut et répondre</span> : undefined}
    >
      {suggestions.map((s) => (
        <LigneTableau key={s.id} grille={GRILLE} testid="suggestion" label={`Suggestion du ${formatDate(s.createdAt)}`} onClick={() => onSelect(s.id)} actif={selectedId === s.id}>
          <span className="text-text-muted">{formatDate(s.createdAt)}</span>
          <span className="line-clamp-2 text-text">{s.content}</span>
          <span className={`block truncate ${s.isAnonymous ? 'italic text-text-muted' : ''}`}>{auteur(s)}</span>
          <Pastille ton={STATUS_TON[s.status]}>{STATUS_LABEL[s.status]}</Pastille>
          <button
            type="button"
            className={s.status === 'RECUE' ? BTN_LIGNE_PRINCIPAL : BTN_LIGNE}
            onClick={(e) => (e.stopPropagation(), onSelect(s.id))}
            aria-label={`Voir la suggestion du ${formatDate(s.createdAt)}`}
          >
            Voir
          </button>
        </LigneTableau>
      ))}
    </Tableau>
  );
}
