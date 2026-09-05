'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Announcement } from '../../lib/communication/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const SCOPE_TONE: Record<Announcement['scope'], 'accent' | 'gold' | 'sage' | 'clay' | 'muted'> = {
  DNPEC: 'clay',
  DIVISION: 'accent',
  SECTION: 'accent',
  CELLULE: 'gold',
  GROUPE_PERSONNALISE: 'muted',
};

export function AnnouncementList({
  announcements,
  onSelect,
}: {
  announcements: Announcement[];
  onSelect: (id: string) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();

  if (announcements.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucune annonce pour l&apos;instant.</p>;
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <Card
          key={announcement.id}
          onClick={() => onSelect(announcement.id)}
          className="cursor-pointer p-[18px] hover:border-accent/40"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge tone={SCOPE_TONE[announcement.scope]}>{SCOPE_LABEL[announcement.scope]}</Badge>
            <span className="text-[11px] text-text-faint">{formatDate(announcement.createdAt)}</span>
          </div>
          <div className="mb-1 text-[14.5px] font-bold">{announcement.title}</div>
          <p className="line-clamp-2 text-[13px] text-text-muted">{announcement.body}</p>
          <div className="mt-2 text-[11px] text-text-faint">
            Par {announcement.authorId === currentUser?.id ? 'vous' : getUserLabel(announcement.authorId)}
          </div>
        </Card>
      ))}
    </div>
  );
}
