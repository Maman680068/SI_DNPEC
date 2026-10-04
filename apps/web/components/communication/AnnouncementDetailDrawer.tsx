'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { getAnnouncementReads, markAnnouncementRead } from '../../lib/api/communication';
import type { Announcement, AnnouncementReadReceipt } from '../../lib/communication/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { CleValeur, Pastille, SectionFenetre } from '../ui/Charte';
import { TON_PORTEE } from './AnnouncementList';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { FenetreDetail } from '../ui/FenetreDetail';

const LEADERSHIP_ROLES = ['DN', 'DNA', 'ADMIN_SYSTEME'];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function AnnouncementDetailDrawer({
  announcement,
  onClose,
}: {
  announcement: Announcement;
  onClose: () => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  const [reads, setReads] = useState<AnnouncementReadReceipt[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const canSeeReads = announcement.authorId === currentUser?.id || LEADERSHIP_ROLES.includes(currentUser?.role ?? '');

  useEffect(() => {
    // L'auteur consultant sa propre annonce ne doit pas s'ajouter à son propre
    // suivi de lecture — "Lue par X personnes" doit compter l'audience, pas l'auteur.
    if (announcement.authorId !== currentUser?.id) {
      markAnnouncementRead(announcement.id).catch(() => undefined);
    }
    if (canSeeReads) {
      getAnnouncementReads(announcement.id)
        .then(setReads)
        .catch((err) => setErreurChargement(messageChargement(err)));
    }
  }, [announcement.id]);

  const auteur = announcement.authorId === currentUser?.id ? 'Vous' : getUserLabel(announcement.authorId);

  return (
    <FenetreDetail
      titre={announcement.title}
      onClose={onClose}
      largeur={860}
      filAriane={['Communication', 'Annonces']}
      testid="fenetre-annonce"
      cote={
        <>
          <SectionFenetre titre="Actions">
            <p className="text-[12.5px] leading-snug text-text-muted">
              {announcement.authorId === currentUser?.id
                ? 'Votre annonce est diffusée à sa portée ; le suivi de lecture se met à jour à chaque ouverture.'
                : 'Aucune action attendue : l’annonce est marquée lue à son ouverture.'}
            </p>
          </SectionFenetre>
          <SectionFenetre titre="Informations">
            <CleValeur
              largeur={90}
              lignes={[
                ['Portée', <Pastille key="p" ton={TON_PORTEE[announcement.scope]}>{SCOPE_LABEL[announcement.scope]}</Pastille>],
                ['Auteur', auteur],
                ['Publiée le', formatDateTime(announcement.createdAt)],
              ]}
            />
          </SectionFenetre>
          {canSeeReads && (
            <SectionFenetre titre={`Lue par ${reads?.length ?? '…'} personne${reads && reads.length > 1 ? 's' : ''}`} className="mb-0">
              <ErreurChargement message={erreurChargement} />
              {reads === null ? (
                <Chargement erreur={erreurChargement} className="text-[13px] text-text-muted" />
              ) : reads.length === 0 ? (
                <p className="text-[13px] text-text-muted">Personne n’a encore lu cette annonce.</p>
              ) : (
                <ul className="space-y-1.5" data-testid="lectures-annonce">
                  {reads.map((read) => (
                    <li key={read.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate">{getUserLabel(read.userId)}</span>
                      <span className="flex-none text-[11.5px] text-text-muted">{formatDateTime(read.readAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionFenetre>
          )}
        </>
      }
    >
      <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-text">{announcement.body}</div>
    </FenetreDetail>
  );
}
