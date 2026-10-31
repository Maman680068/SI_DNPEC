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
import { RolesModelisationModal } from './RolesModelisationModal';
import { renvoyerInvitation, type CompteSynthese } from '../../lib/api/users';
import { ApiError } from '../../lib/api/client';

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

/** Dernière connexion réussie (journal des connexions) ; « Jamais connecté » sinon. */
function connexion(iso: string | null): string {
  if (!iso) return 'Jamais connecté';
  return `Dernière connexion le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function UsersTable({
  users,
  canManage,
  onRefresh,
  complements,
}: {
  users: AdminUser[];
  /** Rôles fonctionnels (libellés) et double authentification, calculés par l'API (api/v1/comptes/synthese). */
  complements?: Map<string, CompteSynthese>;
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
  const [rolesModelisationDe, setRolesModelisationDe] = useState<AdminUser | null>(null);
  const toast = useToast();

  /** Actions secondaires d'un compte (menu « Plus d'actions »), mêmes conditions qu'avant. */
  const autresActions = (user: AdminUser): ActionMenu[] => [
    ...(CAN_BECOME_CHEF_ROLES.includes(user.role) ? [{ label: 'Nommer chef de cellule', onSelect: () => setAssigningChefFor(user) }] : []),
    ...(user.status === 'ACTIF' ? [{ label: 'Changer de rôle', onSelect: () => setChangingRoleFor(user) }] : []),
    // Domaine B (lot B1) : analyste, responsable ou suppléant d'un modèle — jamais pour un stagiaire.
    ...(user.status === 'ACTIF' && user.role !== 'STAGIAIRE' ? [{ label: 'Rôles de modélisation', onSelect: () => setRolesModelisationDe(user) }] : []),
    // S9b : compte jamais utilisé (droit calculé par l'API) — nouvel e-mail avec un lien neuf.
    ...(complements?.get(user.id)?.renvoyerInvitation ? [{ label: 'Renvoyer l’invitation', onSelect: () => void renvoyer(user) }] : []),
  ];

  async function renvoyer(user: AdminUser) {
    try {
      await renvoyerInvitation(user.id);
      toast.succes('Invitation renvoyée', { detail: `${user.firstName} ${user.lastName} reçoit un nouveau lien pour choisir son mot de passe (7 jours).` });
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'L’invitation n’a pas pu être renvoyée.');
    }
  }

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
              {ROLE_LABEL[user.role]} · {complements?.get(user.id)?.sigleUnite ?? attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}
              {complements?.get(user.id) && (
                <span className="block">
                  {complements.get(user.id)!.rolesFonctionnels.join(', ') || 'Aucun rôle fonctionnel'} · Double authentification : {complements.get(user.id)!.doubleAuthentification ? 'activée' : 'non'} · {connexion(complements.get(user.id)!.derniereConnexion)}
                </span>
              )}
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
        {/* S9b : aucun texte coupé — nom et e-mail l'un sous l'autre, rôle et sigle d'unité dessous,
         * rôles fonctionnels en étiquettes, colonne « Sécurité » (double authentification, dernière connexion). */}
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="h-[38px] border-b border-line bg-fond-doux text-[12px] font-semibold text-text-muted">
              <th scope="col" className="px-3 py-2">Personne</th>
              <th scope="col" className="px-3 py-2">Rôle et unité</th>
              {complements && <th scope="col" className="px-3 py-2">Rôles fonctionnels</th>}
              {complements && <th scope="col" className="px-3 py-2">Sécurité</th>}
              <th scope="col" className="px-3 py-2">Statut</th>
              {canManage && <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const c = complements?.get(user.id);
              return (
                <tr key={user.id} className="border-b border-line-doux align-top last:border-0 hover:bg-survol" data-testid="ligne-compte">
                  <td className="break-words px-3 py-2.5">
                    <b className="block font-semibold text-ink-900">{user.firstName} {user.lastName}</b>
                    <span className="block break-all text-[12px] text-text-muted">{user.email}</span>
                  </td>
                  <td className="px-3 py-2.5" data-testid="role-compte">
                    <span className="block">{ROLE_LABEL[user.role]}</span>
                    <span className="block text-[12px] text-text-muted" title={attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}>
                      {c?.sigleUnite ?? attachmentLabel(user, getDivisionName, getSectionName, getCelluleName, getUserLabel)}
                    </span>
                  </td>
                  {complements && (
                    <td className="px-3 py-2.5" data-testid="roles-fonctionnels">
                      {c && c.rolesFonctionnels.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {c.rolesFonctionnels.map((r) => (
                            <Pastille key={r} ton="encre">{r}</Pastille>
                          ))}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  )}
                  {complements && (
                    <td className="whitespace-nowrap px-3 py-2.5" data-testid="double-authentification">
                      {c?.doubleAuthentification ? <Pastille ton="vert">2FA activée</Pastille> : <Pastille ton={c?.droitsEleves ? 'rouge' : 'ambre'}>2FA : Non</Pastille>}
                      <span className="mt-1 block text-[12px] text-text-muted" data-testid="derniere-connexion">{connexion(c?.derniereConnexion ?? null)}</span>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Pastille ton={PASTILLE[STATUS_BADGE_TONE[user.status]]}>{STATUS_BADGE_LABEL[user.status]}</Pastille>
                    {c?.demonstration && <span className="mt-1 block text-[12px] text-text-muted">Démonstration</span>}
                  </td>
                  {canManage && (
                    <td className="w-px whitespace-nowrap px-3 py-2.5">
                      {/* Un seul bouton visible, les autres actions dans « Plus d'actions ». */}
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className={BTN_LIGNE} onClick={() => setManagingAccountFor(user)}>
                          Gérer
                        </button>
                        <MenuActions actions={autresActions(user)} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
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

      {rolesModelisationDe && <RolesModelisationModal userId={rolesModelisationDe.id} onClose={() => setRolesModelisationDe(null)} />}

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
