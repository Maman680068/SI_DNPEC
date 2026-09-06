'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { DirectoryUser } from '../../lib/org/types';
import type { SystemRole } from '../../lib/auth/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Button } from '../ui/Button';
import { CreateTaskModal } from '../tasks/CreateTaskModal';

/** Rôles ayant potentiellement autorité hiérarchique sur autrui (voir
 * CascadeService.hasDirectAuthorityOver côté API) — pour ne pas proposer une
 * assignation vouée à l'échec à un rôle qui n'a jamais autorité que sur
 * lui-même (Agent, Assistant de direction, Admin Système — §3.1 : la CSID
 * gère les comptes, pas le contenu métier des tâches). Le serveur reste seul
 * juge au final : même pour ces rôles, cibler quelqu'un hors de son propre
 * périmètre (autre division, etc.) est toujours rejeté en 403.
 */
const ROLES_WITH_POSSIBLE_AUTHORITY: SystemRole[] = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function PersonDetailModal({ person, onClose }: { person: DirectoryUser; onClose: () => void }) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();
  const [showCreateTask, setShowCreateTask] = useState(false);

  const isSelf = person.id === currentUser?.id;
  const canPossiblyAssign = !isSelf && ROLES_WITH_POSSIBLE_AUTHORITY.includes(currentUser?.role as SystemRole);

  const orgUnit = person.celluleId
    ? getCelluleName(person.celluleId)
    : [getDivisionName(person.divisionId), getSectionName(person.sectionId)].filter(Boolean).join(' · ');

  // Remplace la fiche par le formulaire plutôt que de superposer deux
  // panneaux plein écran — plus lisible qu'empiler deux fonds assombris.
  if (showCreateTask) {
    return (
      <CreateTaskModal
        presetAssignee={person}
        onClose={() => setShowCreateTask(false)}
        onCreated={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-lg bg-surface p-6"
      >
        <div className="mb-5 flex items-center gap-3.5">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gold text-[18px] font-bold text-ink">
            {initials(person.firstName, person.lastName)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-bold">
              {person.firstName} {person.lastName}
            </div>
            <div className="truncate text-[13px] text-text-muted">
              {person.jobTitle ?? ROLE_LABEL[person.role as keyof typeof ROLE_LABEL] ?? person.role}
            </div>
          </div>
        </div>

        <dl className="mb-5 space-y-2 text-[13px]">
          {person.jobTitle && (
            <div className="flex justify-between gap-3">
              <dt className="text-text-faint">Rôle</dt>
              <dd className="text-right font-medium">{ROLE_LABEL[person.role as keyof typeof ROLE_LABEL] ?? person.role}</dd>
            </div>
          )}
          {orgUnit && (
            <div className="flex justify-between gap-3">
              <dt className="text-text-faint">Rattachement</dt>
              <dd className="text-right font-medium">{orgUnit}</dd>
            </div>
          )}
        </dl>

        {isSelf ? (
          <p className="mb-1 text-center text-[12.5px] text-text-faint">C&apos;est votre propre fiche.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="solid" onClick={() => router.push(`/communication?with=${person.id}`)}>
              Envoyer un message
            </Button>
            {canPossiblyAssign && (
              <Button variant="outline" onClick={() => setShowCreateTask(true)}>
                Assigner une tâche
              </Button>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
