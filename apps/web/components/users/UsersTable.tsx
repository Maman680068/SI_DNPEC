'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import type { AdminUser, UserStatus } from '../../lib/users/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { BTN_LIGNE, EtatVide, Pastille, type TonPastille } from '../ui/Charte';
import { AssignChefModal } from './AssignChefModal';
import { ManageAccountModal } from './ManageAccountModal';
import { ChangeRoleModal } from './ChangeRoleModal';
import { useToast } from '../ui/Toast';
import { MenuActions, type ActionMenu } from '../ui/MenuActions';

const STATUS_BADGE_TONE: Record<UserStatus, 'sage' | 'clay' | 'muted'> = {
  EN_ATTENTE: 'muted',
  ACTIF: 'sage',
  SUSPENDU: 'clay',
  SUPPRIME: 'muted',
};

const PASTILLE: Record<'sage' | 'clay' | 'muted', TonPastille> = { sage: 'vert', clay: 'rouge', muted: 'gris' };

const STATUS_BADGE_LABEL: Record<UserStatus, string> = {
  EN_ATTENTE: 'En attente',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  SUPPRIME: 'Désactivé',
};

/** Raccourci « Nommer chef de cellule » pour un Agent ou un Chef de Cellule (réaffectation) ;
 * l'API refuse de toute façon (409) un DN, une DNA ou un Chef de Division. Tout autre
 * changement passe par « Changer de rôle » (même mécanisme côté API). */
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
  const [changingRoleFor, setChangingRoleFor] = useState<AdminUser | null>(null);
  const toast = useToast();

  /** Actions secondaires d'un compte (menu « Plus d'actions »), mêmes conditions qu'avant. */
  const autresActions = (user: AdminUser): ActionMenu[] => [
    ...(CAN_BECOME_CHEF_ROLES.includes(user.role) ? [{ label: 'Nommer chef de cellule', onSelect: () => setAssigningChefFor(user) }] : []),
    ...(user.status === 'ACTIF' ? [{ label: 'Changer de rôle', onSelect: () => setChangingRoleFor(user) }] : []),
  ];

  if (users.length === 0) {
    return <div className="rounded-xl border border-line bg-surface"><EtatVide texte="Aucun compte." /></div>;
  }

  return (
    <div>
      {/* En dessous de md, un tableau à 5-6 colonnes ne tient pas sur un écran de
       * téléphone même avec un scroll horizontal (en-têtes tronqués, actions hors
       * champ) — on bascule sur des cartes empilées, une par utilisateur. */}
      <div className="space-y-2.5 md:hidden">
        {users.map((user) => (
          <div key={user.id} className="rounded-xl border border-line bg-surface p-3.5" data-testid="carte-compte">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-[13.5px] font-semibold">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-[12px] text-text-muted">{user.email}</div>
              </div>
              <Pastille ton={PASTILLE[STATUS_BADGE_TONE[user.status]]}>{STATUS_BADGE_LABEL[user.status]}</Pastille>
            </div>
            <div className="mb-3 text-[12.5px] text-text-muted">
              {ROLE_LABEL[user.role]} · {attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}
            </div>
            {canManage && (
              <div className="flex items-center gap-1.5">
                <button type="button" className={BTN_LIGNE} onClick={() => setManagingAccountFor(user)}>
                  Gérer
                </button>
                <MenuActions actions={autresActions(user)} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="h-[38px] border-b border-line bg-[#F7F8FB] text-[12px] font-semibold text-text-muted">
              <th scope="col" className="px-4 py-2">Nom</th>
              <th scope="col" className="px-4 py-2">Email</th>
              <th scope="col" className="px-4 py-2">Rôle</th>
              <th scope="col" className="px-4 py-2">Rattachement</th>
              <th scope="col" className="px-4 py-2">Statut</th>
              {canManage && <th scope="col" className="px-4 py-2"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[#F0F1F6] last:border-0 hover:bg-[#F6F7FC]">
                {/* Une seule ligne par cellule (texte long raccourci, complet au survol) : toutes les lignes ont la même hauteur. */}
                <td className="max-w-[160px] truncate whitespace-nowrap px-4 py-2.5 font-semibold text-ink-900" title={`${user.firstName} ${user.lastName}`}>
                  {user.firstName} {user.lastName}
                </td>
                <td className="max-w-[200px] truncate whitespace-nowrap px-4 py-2.5 text-text-muted" title={user.email}>{user.email}</td>
                <td className="max-w-[170px] truncate whitespace-nowrap px-4 py-2.5" title={ROLE_LABEL[user.role]}>{ROLE_LABEL[user.role]}</td>
                <td className="max-w-[180px] truncate whitespace-nowrap px-4 py-2.5 text-text-muted" title={attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}>
                  {attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Pastille ton={PASTILLE[STATUS_BADGE_TONE[user.status]]}>{STATUS_BADGE_LABEL[user.status]}</Pastille>
                </td>
                {canManage && (
                  <td className="w-px whitespace-nowrap px-4 py-2.5">
                    {/* Un seul bouton visible, les autres actions dans « Plus d'actions » : lignes de même hauteur. */}
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className={BTN_LIGNE} onClick={() => setManagingAccountFor(user)}>
                        Gérer
                      </button>
                      <MenuActions actions={autresActions(user)} />
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
          onAssigned={(cellule) => {
            const u = assigningChefFor;
            setAssigningChefFor(null);
            onRefresh();
            toast.succes('Chef de cellule nommé', { detail: `${u.firstName} ${u.lastName} dirige ${cellule} ; ses sessions sont fermées.` });
          }}
        />
      )}

      {changingRoleFor && (
        <ChangeRoleModal
          user={changingRoleFor}
          onClose={() => setChangingRoleFor(null)}
          onChanged={(role) => {
            const u = changingRoleFor;
            setChangingRoleFor(null);
            onRefresh();
            toast.succes('Rôle changé', { detail: `${u.firstName} ${u.lastName} est maintenant ${ROLE_LABEL[role]} ; la personne et les DRH sont prévenus.` });
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
