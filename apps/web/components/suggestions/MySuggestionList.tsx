'use client';

import type { Suggestion } from '../../lib/suggestions/types';
import { STATUS_LABEL } from '../../lib/suggestions/types';
import { BTN_LIGNE, BTN_SECONDAIRE, EtatVide, LigneTableau, Pastille, Tableau, type TonPastille } from '../ui/Charte';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Reçue : encre ; en étude : ambre ; retenue : vert ; non retenue : rouge. */
export const STATUS_TON: Record<Suggestion['status'], TonPastille> = {
  RECUE: 'encre',
  EN_ETUDE: 'ambre',
  RETENUE: 'vert',
  NON_RETENUE: 'rouge',
};

const GRILLE = 'lg:grid-cols-[110px_minmax(0,1.3fr)_minmax(0,1fr)_120px_84px]';

/** Mes suggestions (non anonymes) : texte, réponse de la Direction, statut ; la ligne s'ouvre en fenêtre. */
export function MySuggestionList({
  suggestions,
  onNouvelle,
  onSelect,
  filtre,
  onEffacer,
}: {
  suggestions: Suggestion[];
  onNouvelle?: () => void;
  onSelect: (id: string) => void;
  filtre?: boolean;
  onEffacer?: () => void;
}) {
  return (
    <Tableau
      label="Mes suggestions"
      testid="mes-suggestions"
      grille={GRILLE}
      colonnes={['Envoyée le', 'Suggestion', 'Réponse de la Direction', 'Statut', <span key="a" className="sr-only">Action</span>]}
      vide={
        filtre ? (
          <EtatVide texte="Aucune suggestion ne correspond aux filtres." action={onEffacer ? <button type="button" className={BTN_SECONDAIRE} onClick={onEffacer}>Effacer les filtres</button> : undefined} />
        ) : (
          <EtatVide
            texte="Vous n’avez pas encore soumis de suggestion (les suggestions envoyées anonymement n’apparaissent pas ici)."
            action={onNouvelle ? <button type="button" className={BTN_SECONDAIRE} onClick={onNouvelle}>Proposer une suggestion</button> : undefined}
          />
        )
      }
      pied={suggestions.length > 0 ? <span>{suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} · les suggestions anonymes n’apparaissent pas ici</span> : undefined}
    >
      {suggestions.map((s) => (
        <LigneTableau key={s.id} grille={GRILLE} testid="ma-suggestion" label={`Ma suggestion du ${formatDate(s.createdAt)}`} onClick={() => onSelect(s.id)}>
          <span className="text-text-muted">{formatDate(s.createdAt)}</span>
          <span className="line-clamp-2 text-text">{s.content}</span>
          <span className="line-clamp-2 text-[13px] text-text-muted">{s.response ?? '—'}</span>
          <Pastille ton={STATUS_TON[s.status]}>{STATUS_LABEL[s.status]}</Pastille>
          <button type="button" className={BTN_LIGNE} onClick={(e) => (e.stopPropagation(), onSelect(s.id))} aria-label={`Voir ma suggestion du ${formatDate(s.createdAt)}`}>
            Voir
          </button>
        </LigneTableau>
      ))}
    </Tableau>
  );
}
