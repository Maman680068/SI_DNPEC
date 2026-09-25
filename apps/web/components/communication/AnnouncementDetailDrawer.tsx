'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { getAnnouncementReads, markAnnouncementRead } from '../../lib/api/communication';
import type { Announcement, AnnouncementReadReceipt } from '../../lib/communication/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { Badge } from '../ui/Badge';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

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

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-[rgba(20,26,38,0.42)]" onClick={onClose}>
      <div
        className="h-full w-full max-w-[92vw] overflow-y-auto bg-surface px-[26px] pb-10 pt-[26px] sm:w-[460px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <Badge tone="accent">{SCOPE_LABEL[announcement.scope]}</Badge>
          <button onClick={onClose} className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        <h2 className="mb-1.5 text-[19px] font-semibold leading-snug">{announcement.title}</h2>
        <p className="mb-5 text-[12px] text-text-faint">
          Par {announcement.authorId === currentUser?.id ? 'vous' : getUserLabel(announcement.authorId)} ·{' '}
          {formatDateTime(announcement.createdAt)}
        </p>

        <div className="mb-6 whitespace-pre-wrap rounded-md bg-bg p-3.5 text-[13.5px] leading-relaxed">
          {announcement.body}
        </div>

        {canSeeReads && (
          <div>
            <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-text-muted">
              Lue par {reads?.length ?? '…'} personne{reads && reads.length > 1 ? 's' : ''}
            </div>
            <ErreurChargement message={erreurChargement} />
            {reads === null ? (
              <Chargement erreur={erreurChargement} className="text-[13px] text-text-muted" />
            ) : reads.length === 0 ? (
              <p className="text-[13px] text-text-faint">Personne n&apos;a encore lu cette annonce.</p>
            ) : (
              <ul className="space-y-1.5">
                {reads.map((read) => (
                  <li key={read.id} className="flex items-center justify-between text-[13px]">
                    <span>{getUserLabel(read.userId)}</span>
                    <span className="text-[11px] text-text-faint">{formatDateTime(read.readAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
