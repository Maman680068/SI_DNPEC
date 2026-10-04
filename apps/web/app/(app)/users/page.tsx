'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { listAllUsers, listPendingUsers } from '../../../lib/api/users';
import type { AdminUser } from '../../../lib/users/types';
import { USERS_PAGE_VISIBLE_ROLES } from '../../../lib/users/types';
import { UsersTable } from '../../../components/users/UsersTable';
import { PendingRegistrationsList } from '../../../components/users/PendingRegistrationsList';
import { CreateUserModal } from '../../../components/users/CreateUserModal';
import { ApproveRegistrationModal } from '../../../components/users/ApproveRegistrationModal';
import { Plus } from 'lucide-react';
import { BTN_PRINCIPAL, EnTetePage, Onglets } from '../../../components/ui/Charte';
import { RolesFonctionnels } from '../../../components/socle/RolesFonctionnels';
import { NominationsRole } from '../../../components/users/NominationsRole';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';

type Tab = 'all' | 'pending' | 'roles' | 'nominations';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN_SYSTEME';
  const hasAccess = USERS_PAGE_VISIBLE_ROLES.includes(currentUser?.role ?? '');

  const [tab, setTab] = useState<Tab>('all');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[] | null>(null);
  const [pendingUsers, setPendingUsers] = useState<AdminUser[] | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [approving, setApproving] = useState<AdminUser | null>(null);

  const loadAll = useCallback(() => {
    listAllUsers().then(setAllUsers).catch((err) => setErreurChargement(messageChargement(err)));
  }, []);

  // Lien des notifications de nomination : /users?onglet=nominations.
  useEffect(() => {
    if (isAdmin && new URLSearchParams(window.location.search).get('onglet') === 'nominations') setTab('nominations');
  }, [isAdmin]);

  useEffect(() => {
    if (!hasAccess) return;
    loadAll();
    // GET /users/pending est réservé à ADMIN_SYSTEME côté API — DN/DNA n'y ont pas accès.
    if (isAdmin) listPendingUsers().then(setPendingUsers).catch((err) => setErreurChargement(messageChargement(err)));
  }, [hasAccess, isAdmin, loadAll]);

  if (!hasAccess) {
    return (
      <div className="py-16 text-center">
        <h1 className="mb-2 font-heading text-[19px] font-bold text-ink-900">Accès non autorisé</h1>
        <p className="text-[13.5px] text-text-muted">Cette page est réservée à l’Administrateur Système et à la Direction.</p>
      </div>
    );
  }

  // Les comptes en attente ont leur propre onglet : la liste "Tous les comptes" ne
  // montre que ce qui est effectivement géré ici (actif/suspendu).
  const activeAndSuspended = (allUsers ?? []).filter((u) => u.status !== 'EN_ATTENTE');

  function handleCreated(user: AdminUser) {
    setAllUsers((prev) => (prev ? [...prev, user] : [user]));
    setShowCreateModal(false);
  }

  function handleApproved(updated: AdminUser) {
    setPendingUsers((prev) => prev?.filter((u) => u.id !== updated.id) ?? prev);
    setAllUsers((prev) => (prev ? [...prev, updated] : [updated]));
    setApproving(null);
  }

  function handleRejected(id: string) {
    setPendingUsers((prev) => prev?.filter((u) => u.id !== id) ?? prev);
  }

  return (
    <div>
      <EnTetePage
        titre="Utilisateurs"
        sousTitre={allUsers ? `${activeAndSuspended.length} compte(s) actif(s) ou suspendu(s)` : undefined}
        actions={
          isAdmin &&
          tab === 'all' && (
            <button type="button" className={BTN_PRINCIPAL} onClick={() => setShowCreateModal(true)}>
              <Plus aria-hidden size={17} /> Nouveau compte
            </button>
          )
        }
      />
      <ErreurChargement message={erreurChargement} />

      {isAdmin && (
        <Onglets
          label="Utilisateurs"
          actif={tab}
          onChange={setTab}
          onglets={[
            { cle: 'all', label: 'Tous les comptes' },
            { cle: 'pending', label: 'Inscriptions en attente', n: pendingUsers?.length ?? null, chaud: true },
            { cle: 'roles', label: 'Rôles fonctionnels' },
            { cle: 'nominations', label: 'Nominations' },
          ]}
        />
      )}

      {tab === 'nominations' && isAdmin ? (
        <NominationsRole />
      ) : tab === 'roles' && isAdmin ? (
        <RolesFonctionnels />
      ) : tab === 'all' || !isAdmin ? (
        allUsers === null ? (
          <Chargement erreur={erreurChargement} />
        ) : (
          <UsersTable users={activeAndSuspended} canManage={isAdmin} onRefresh={loadAll} />
        )
      ) : pendingUsers === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <PendingRegistrationsList users={pendingUsers} onApprove={setApproving} onRejected={handleRejected} />
      )}

      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
      {approving && (
        <ApproveRegistrationModal user={approving} onClose={() => setApproving(null)} onApproved={handleApproved} />
      )}
    </div>
  );
}
