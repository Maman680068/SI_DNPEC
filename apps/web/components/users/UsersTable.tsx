'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import type { AdminUser, UserStatus } from '../../lib/users/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AssignChefModal } from './AssignChefModal';
import { ManageAccountModal } from './ManageAccountModal';

const STATUS_BADGE_TONE: Record<UserStatus, 'sage' | 'clay' | 'muted'> = {
  EN_ATTENTE: 'muted',
  ACTIF: 'sage',
  SUSPENDU: 'clay',
  SUPPRIME: 'muted',
};

const STATUS_BADGE_LABEL: Record<UserStatus, string> = {
  EN_ATTENTE: 'En attente',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  SUPPRIME: 'Supprimé',
};

/** "Nommer chef de cellule" n'a de sens que pour un Agent (le cas courant : promouvoir
 * quelqu'un qui travaille déjà dans la cellule) ou un Chef de Cellule déjà en poste
 * (réaffectation à une autre cellule). Le masquer pour les autres rôles évite un vrai
 * piège côté API : CellulesService.assignChef écrase le rôle sans condition — nommer
 * par erreur un DN ou l'Administrateur Système chef de cellule le rétrograderait. */
const CAN_BECOME_CHEF_ROLES = ['AGENT', 'CHEF_CELLULE'];

function attachmentLabel(
  user: AdminUser,
  getDivisionName: (id: string | null) => string | null,
  getSectionName: (id: string | null) => string | null,
  getCelluleName: (id: string | null) => string | null,
  getUserLabel: (id: string) => string,
): string {
  if (user.supervisorId) return `Assiste ${getUserLabel(user.supervisorId)}`;
  if (user.celluleId) return getCelluleName(user.celluleId) ?? '—';
  if (user.divisionId) {
    const division = getDivisionName(user.divisionId);
    const section = getSectionName(user.sectionId);
    return section ? `${division} · ${section}` : division ?? '—';
  }
  return '—';
}

export function UsersTable({
  users,
  canManage,
  onRefresh,
}: {
  users: AdminUser[];
  /** ADMIN_SYSTEME uniquement — DN/DNA voient cette liste en lecture seule
   * (PATCH /users/:id/status et POST /org/cellules/:id/chef sont réservés à
   * ADMIN_SYSTEME côté API). */
  canManage: boolean;
  /** Un rafraîchissement complet plutôt qu'un patch local : nommer un chef de
   * cellule change deux lignes à la fois (le nouveau chef ET l'ancien, démis),
   * pas seulement celle sur laquelle l'action a été déclenchée. */
  onRefresh: () => void;
}) {
  const { getDivisionName, getSectionName, getCelluleName, getUserLabel } = useOrg();
  const [assigningChefFor, setAssigningChefFor] = useState<AdminUser | null>(null);
  const [managingAccountFor, setManagingAccountFor] = useState<AdminUser | null>(null);

  if (users.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucun compte.</p>;
  }

  return (
    <div>
      {/* En dessous de md, un tableau à 5-6 colonnes ne tient pas sur un écran de
       * téléphone même avec un scroll horizontal (en-têtes tronqués, actions hors
       * champ) — on bascule sur des cartes empilées, une par utilisateur. */}
      <div className="space-y-2.5 md:hidden">
        {users.map((user) => (
          <div key={user.id} className="rounded-lg border border-line p-3.5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-[13.5px] font-semibold">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-[12px] text-text-muted">{user.email}</div>
              </div>
              <Badge tone={STATUS_BADGE_TONE[user.status]}>{STATUS_BADGE_LABEL[user.status]}</Badge>
            </div>
            <div className="mb-3 text-[12.5px] text-text-muted">
              {ROLE_LABEL[user.role]} · {attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {CAN_BECOME_CHEF_ROLES.includes(user.role) && (
                  <Button variant="outline" onClick={() => setAssigningChefFor(user)}>
                    Nommer chef de cellule
                  </Button>
                )}
                <Button variant="outline" onClick={() => setManagingAccountFor(user)}>
                  Gérer
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-bg text-[11px] font-bold uppercase tracking-wide text-text-faint">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Rattachement</th>
              <th className="px-4 py-3">Statut</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold">
                  {user.firstName} {user.lastName}
                </td>
                <td className="px-4 py-3 text-text-muted">{user.email}</td>
                <td className="px-4 py-3">{ROLE_LABEL[user.role]}</td>
                <td className="px-4 py-3 text-text-muted">
                  {attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_BADGE_TONE[user.status]}>{STATUS_BADGE_LABEL[user.status]}</Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {CAN_BECOME_CHEF_ROLES.includes(user.role) && (
                        <Button variant="outline" onClick={() => setAssigningChefFor(user)}>
                          Nommer chef de cellule
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setManagingAccountFor(user)}>
                        Gérer
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assigningChefFor && (
        <AssignChefModal
          user={assigningChefFor}
          onClose={() => setAssigningChefFor(null)}
          onAssigned={() => {
            setAssigningChefFor(null);
            onRefresh();
          }}
        />
      )}

      {managingAccountFor && (
        <ManageAccountModal
          user={managingAccountFor}
          onClose={() => setManagingAccountFor(null)}
          onChanged={() => {
            setManagingAccountFor(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
