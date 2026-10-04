'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Poll } from '../../lib/polls/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { EtatVide, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { TON_PORTEE } from './AnnouncementList';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const GRILLE = 'lg:grid-cols-[minmax(0,1fr)_170px_150px_80px_130px]';

/** Sondages en tableau compact : question et auteur, portée, état (à répondre, voté, clôturé), votes, date. */
export function PollList({ polls, onSelect, vide }: { polls: Poll[]; onSelect: (id: string) => void; vide?: ReactNode }) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  return (
    <Tableau label="Sondages" grille={GRILLE} colonnes={['Sondage', 'Portée', 'État', 'Votes', 'Date']} testid="sondages" vide={<EtatVide texte="Aucun sondage pour l’instant." action={vide} />}>
      {polls.map((poll) => {
        const vote = poll.myOptionIds.length > 0;
        return (
          <LigneTableau key={poll.id} grille={GRILLE} onClick={() => onSelect(poll.id)} label={poll.question} testid="sondage">
            <span className="block min-w-0">
              <b className="block truncate font-semibold text-text">{poll.question}</b>
              <span className="block truncate text-[12.5px] text-text-muted">Par {poll.authorId === currentUser?.id ? 'vous' : getUserLabel(poll.authorId)}</span>
            </span>
            <Pastille ton={TON_PORTEE[poll.scope]}>{SCOPE_LABEL[poll.scope]}</Pastille>
            {poll.isClosed ? <Pastille ton="gris">Clôturé</Pastille> : vote ? <Pastille ton="vert">Vous avez voté</Pastille> : <Pastille ton="ambre">À répondre</Pastille>}
            <span className="text-[13px] font-semibold">
              {poll.totalVoters}
              <span className="font-normal text-text-muted lg:sr-only"> vote{poll.totalVoters > 1 ? 's' : ''}</span>
            </span>
            <span className="text-[12.5px] text-text-muted">{formatDate(poll.createdAt)}</span>
          </LigneTableau>
        );
      })}
    </Tableau>
  );
}
