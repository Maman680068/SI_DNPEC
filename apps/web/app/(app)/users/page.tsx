'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { getSyntheseComptes, listAllUsers, listPendingUsers, type SyntheseComptes } from '../../../lib/api/users';
import type { AdminUser } from '../../../lib/users/types';
import { USERS_PAGE_VISIBLE_ROLES } from '../../../lib/users/types';
import { UsersTable } from '../../../components/users/UsersTable';
import { PendingRegistrationsList } from '../../../components/users/PendingRegistrationsList';
import { CreateUserModal } from '../../../components/users/CreateUserModal';
import { ApproveRegistrationModal } from '../../../components/users/ApproveRegistrationModal';
import { Plus } from 'lucide-react';
import { BTN_LIGNE, BTN_PRINCIPAL, EnTetePage, EtatVide, LigneTableau, Onglets, Tableau } from '../../../components/ui/Charte';
import { RolesFonctionnels } from '../../../components/socle/RolesFonctionnels';
import { NominationsRole } from '../../../components/users/NominationsRole';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { useToast } from '../../../components/ui/Toast';

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
  const [synthese, setSynthese] = useState<SyntheseComptes | null>(null);
  const [agentAOuvrir, setAgentAOuvrir] = useState<string | undefined>(undefined);
  const [approving, setApproving] = useState<AdminUser | null>(null);
  const toast = useToast();

  const loadAll = useCallback(() => {
    listAllUsers().then(setAllUsers).catch((err) => setErreurChargement(messageChargement(err)));
    // Rôles fonctionnels, double authentification, agents sans compte : refusés en intérim (colonnes absentes).
    getSyntheseComptes().then(setSynthese).catch(() => setSynthese(null));
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
    setAgentAOuvrir(undefined);
    loadAll();
    toast.succes('Compte créé', { detail: `${user.firstName} ${user.lastName} reçoit un lien pour choisir son mot de passe.` });
  }

  function handleApproved(updated: AdminUser) {
    setPendingUsers((prev) => prev?.filter((u) => u.id !== updated.id) ?? prev);
    setAllUsers((prev) => (prev ? [...prev, updated] : [updated]));
    setApproving(null);
    toast.succes('Inscription approuvée', { detail: `${updated.firstName} ${updated.lastName} est prévenu(e) par email.` });
  }

  function handleRejected(id: string) {
    const u = pendingUsers?.find((x) => x.id === id);
    setPendingUsers((prev) => prev?.filter((x) => x.id !== id) ?? prev);
    toast.succes('Inscription rejetée', { detail: u ? `${u.firstName} ${u.lastName} est prévenu(e) par email.` : undefined });
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
          <>
            <UsersTable
              users={activeAndSuspended}
              canManage={isAdmin}
              onRefresh={loadAll}
              complements={synthese ? new Map(synthese.comptes.map((c) => [c.id, c])) : undefined}
            />
            {synthese && (
              <AgentsSansCompte
                synthese={synthese}
                onOuvrir={(id) => {
                  setAgentAOuvrir(id);
                  setShowCreateModal(true);
                }}
              />
            )}
          </>
        )
      ) : pendingUsers === null ? (
        <Chargement erreur={erreurChargement} />
      ) : (
        <PendingRegistrationsList users={pendingUsers} onApprove={setApproving} onRejected={handleRejected} />
      )}

      {showCreateModal && (
        <CreateUserModal
          agentInitial={agentAOuvrir}
          onClose={() => {
            setShowCreateModal(false);
            setAgentAOuvrir(undefined);
          }}
          onCreated={handleCreated}
        />
      )}
      {approving && (
        <ApproveRegistrationModal user={approving} onClose={() => setApproving(null)} onApproved={handleApproved} />
      )}
    </div>
  );
}

const GRILLE_AGENTS = 'lg:grid-cols-[110px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_110px_130px]';

/** Agents en activité du socle sans compte : « Ouvrir un compte » (administrateur) crée le compte rattaché à l'agent. */
function AgentsSansCompte({ synthese, onOuvrir }: { synthese: SyntheseComptes; onOuvrir: (agentId: string) => void }) {
  const l = synthese.agentsSansCompte;
  return (
    <section className="mt-6" aria-labelledby="titre-agents-sans-compte">
      <h2 id="titre-agents-sans-compte" className="mb-1 text-[15px] font-bold text-ink-900">
        Agents sans compte {l.length > 0 && <span className="text-text-muted">· {l.length}</span>}
      </h2>
      <p className="mb-3 text-[13px] text-text-muted">Agents en activité du dossier RH qui n’ont pas encore de compte de connexion. Un compte est toujours rattaché à un agent.</p>
      <Tableau
        label="Agents sans compte"
        testid="agents-sans-compte"
        grille={GRILLE_AGENTS}
        colonnes={['Matricule', 'Nom', 'Fonction', 'Unité', 'Créé le', '']}
        vide={<EtatVide texte="Tous les agents en activité ont un compte." />}
      >
        {l.map((a) => (
          <LigneTableau key={a.id} grille={GRILLE_AGENTS} testid="agent-sans-compte">
            <span className="font-mono text-[12.5px]">{a.matricule}</span>
            <b className="block truncate font-semibold text-ink-900">{a.prenoms} {a.nom}</b>
            <span className="block truncate text-text-muted">{a.fonction ?? '—'}</span>
            <span className="block truncate text-text-muted">{a.unite ?? '—'}</span>
            <span className="text-text-muted">{new Date(`${a.dateCreation}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</span>
            <span className="flex justify-end">
              {synthese.droits.ouvrirCompte && (
                <button type="button" className={BTN_LIGNE} onClick={() => onOuvrir(a.id)}>
                  Ouvrir un compte
                </button>
              )}
            </span>
          </LigneTableau>
        ))}
      </Tableau>
    </section>
  );
}
