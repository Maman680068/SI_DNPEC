'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { envoyerRappelDoubleAuthentification, getSyntheseComptes, listAllUsers, listPendingUsers, type SyntheseComptes } from '../../../lib/api/users';
import type { AdminUser } from '../../../lib/users/types';
import { ROLE_LABEL, USERS_PAGE_VISIBLE_ROLES } from '../../../lib/users/types';
import { UsersTable } from '../../../components/users/UsersTable';
import { PendingRegistrationsList } from '../../../components/users/PendingRegistrationsList';
import { CreateUserModal } from '../../../components/users/CreateUserModal';
import { ApproveRegistrationModal } from '../../../components/users/ApproveRegistrationModal';
import { Plus, ShieldAlert } from 'lucide-react';
import { BandeCompteurs, Bandeau, BarreOutils, BTN_LIGNE, BTN_PRINCIPAL, BTN_SECONDAIRE, EnTetePage, EtatVide, Filtres, FiltreSelect, Interrupteur, LigneTableau, Onglets, Recherche, Tableau, usePreference } from '../../../components/ui/Charte';
import { ApiError } from '../../../lib/api/client';
import { RolesFonctionnels } from '../../../components/socle/RolesFonctionnels';
import { NominationsRole } from '../../../components/users/NominationsRole';
import { Chargement, ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { useToast } from '../../../components/ui/Toast';

type Tab = 'all' | 'sans-compte' | 'pending' | 'roles' | 'nominations';

/** Onglets ouvrables par lien (?onglet=…). */
const ONGLET_LIEN: Record<string, Tab> = { nominations: 'nominations', inscriptions: 'pending', 'agents-sans-compte': 'sans-compte' };

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

  // Liens : /users?onglet=nominations (notifications), inscriptions, agents-sans-compte.
  useEffect(() => {
    const o = ONGLET_LIEN[new URLSearchParams(window.location.search).get('onglet') ?? ''];
    if (o && (isAdmin || o === 'sans-compte')) setTab(o);
  }, [isAdmin]);

  // S9b : filtres d'affichage (la liste et les chiffres viennent de l'API).
  const [masquerDemo, setMasquerDemo] = usePreference('utilisateurs.masquerDemo', true);
  const [q, setQ] = useState('');
  const [fStatut, setFStatut] = useState('tous');
  const [fRole, setFRole] = useState('tous');
  const [fUnite, setFUnite] = useState('toutes');
  const [f2fa, setF2fa] = useState('tous');
  const [envoi, setEnvoi] = useState(false);

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
  const complements = synthese ? new Map(synthese.comptes.map((c) => [c.id, c])) : undefined;
  const unites = [...new Set((synthese?.comptes ?? []).map((c) => c.sigleUnite).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'fr'));
  const motsQ = q.trim().toLowerCase();
  const affiches = activeAndSuspended.filter((u) => {
    const c = complements?.get(u.id);
    if (masquerDemo && c?.demonstration) return false;
    if (fStatut !== 'tous' && u.status !== fStatut) return false;
    if (fRole !== 'tous' && u.role !== fRole) return false;
    if (fUnite !== 'toutes' && c?.sigleUnite !== fUnite) return false;
    if (f2fa === 'oui' && !c?.doubleAuthentification) return false;
    if (f2fa === 'non' && c?.doubleAuthentification !== false) return false;
    if (motsQ && !`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(motsQ)) return false;
    return true;
  });
  const nbFiltres = [fStatut !== 'tous', fRole !== 'tous', fUnite !== 'toutes', f2fa !== 'tous'].filter(Boolean).length;

  async function rappel() {
    setEnvoi(true);
    try {
      const r = await envoyerRappelDoubleAuthentification();
      toast.succes('Rappel envoyé', { detail: `${r.personnes} personne(s) reçoivent une notification et un e-mail expliquant comment activer la double authentification dans « Mon profil ».` });
    } catch (e) {
      toast.erreur(e instanceof ApiError ? e.message : 'Le rappel n’a pas pu être envoyé.');
    } finally {
      setEnvoi(false);
    }
  }

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
        sousTitre={allUsers ? `${activeAndSuspended.length} compte(s) actif(s), suspendu(s) ou désactivé(s)` : undefined}
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

      {synthese && <ChiffresComptes synthese={synthese} onInscriptions={() => setTab('pending')} />}

      {(isAdmin || synthese) && (
        <Onglets
          label="Utilisateurs"
          actif={tab}
          onChange={setTab}
          onglets={[
            { cle: 'all', label: 'Tous les comptes' },
            ...(synthese ? [{ cle: 'sans-compte' as Tab, label: 'Agents sans compte', n: synthese.agentsSansCompte.length }] : []),
            ...(isAdmin
              ? [
                  { cle: 'pending' as Tab, label: 'Inscriptions en attente', n: pendingUsers?.length ?? null, chaud: true },
                  { cle: 'roles' as Tab, label: 'Rôles fonctionnels' },
                  { cle: 'nominations' as Tab, label: 'Nominations' },
                ]
              : []),
          ]}
        />
      )}

      {tab === 'nominations' && isAdmin ? (
        <NominationsRole />
      ) : tab === 'roles' && isAdmin ? (
        <RolesFonctionnels />
      ) : tab === 'sans-compte' && synthese ? (
        <AgentsSansCompte
          synthese={synthese}
          onOuvrir={(id) => {
            setAgentAOuvrir(id);
            setShowCreateModal(true);
          }}
        />
      ) : tab === 'all' || !isAdmin ? (
        allUsers === null ? (
          <Chargement erreur={erreurChargement} />
        ) : (
          <>
            {synthese && synthese.chiffres.actifsSansDoubleAuthentification > 0 && (
              <Bandeau
                ton={synthese.chiffres.droitsElevesSansDoubleAuthentification > 0 ? 'rouge' : 'ambre'}
                icone={<ShieldAlert aria-hidden size={18} />}
                testid="alerte-2fa"
                action={
                  synthese.droits.envoyerRappel && (
                    <button type="button" className={BTN_SECONDAIRE} disabled={envoi} onClick={() => void rappel()}>
                      Envoyer un rappel
                    </button>
                  )
                }
              >
                <b>{synthese.chiffres.actifsSansDoubleAuthentification} compte(s) actif(s) sans double authentification</b>
                {synthese.chiffres.droitsElevesSansDoubleAuthentification > 0 && <>, dont {synthese.chiffres.droitsElevesSansDoubleAuthentification} aux droits élevés (administrateur, Direction, DRH)</>}
                . Un mot de passe seul ne suffit pas à protéger ces comptes.
              </Bandeau>
            )}
            <BarreOutils
              droite={synthese && <Interrupteur label="Masquer les comptes de démonstration (TEST)" actif={masquerDemo} onChange={setMasquerDemo} testid="masquer-demo" />}
            >
              <Recherche value={q} onChange={setQ} placeholder="Nom ou adresse e-mail" label="Rechercher un compte" />
              <Filtres actifs={nbFiltres} onEffacer={() => { setFStatut('tous'); setFRole('tous'); setFUnite('toutes'); setF2fa('tous'); }}>
                <FiltreSelect label="Statut" value={fStatut} defaut="tous" onChange={setFStatut} options={[{ value: 'tous', label: 'Tous les statuts' }, { value: 'ACTIF', label: 'Actifs' }, { value: 'SUSPENDU', label: 'Suspendus' }, { value: 'SUPPRIME', label: 'Désactivés' }]} />
                <FiltreSelect label="Rôle" value={fRole} defaut="tous" onChange={setFRole} options={[{ value: 'tous', label: 'Tous les rôles' }, ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))]} />
                {synthese && <FiltreSelect label="Unité" value={fUnite} defaut="toutes" onChange={setFUnite} options={[{ value: 'toutes', label: 'Toutes les unités' }, ...unites.map((u) => ({ value: u, label: u }))]} />}
                {synthese && <FiltreSelect label="Double authentification" value={f2fa} defaut="tous" onChange={setF2fa} options={[{ value: 'tous', label: 'Double authentification : toutes' }, { value: 'oui', label: 'Activée' }, { value: 'non', label: 'Non activée' }]} />}
              </Filtres>
            </BarreOutils>
            <UsersTable users={affiches} canManage={isAdmin} onRefresh={loadAll} complements={complements} />
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

/** Cinq chiffres calculés par l'API (api/v1/comptes/synthese). */
function ChiffresComptes({ synthese, onInscriptions }: { synthese: SyntheseComptes; onInscriptions: () => void }) {
  const c = synthese.chiffres;
  return (
    <BandeCompteurs
      label="Chiffres des comptes"
      variante="cartes"
      items={[
        { valeur: c.actifs, label: 'Comptes actifs', testid: 'chiffre-actifs' },
        { valeur: c.suspendus, label: 'Suspendus', sous: c.suspendusDemonstration ? `dont ${c.suspendusDemonstration} de démonstration` : undefined, ton: 'gris', testid: 'chiffre-suspendus' },
        {
          valeur: c.inscriptionsAExaminer,
          label: 'Inscriptions à examiner',
          sous: synthese.droits.examinerInscriptions && c.inscriptionsAExaminer ? 'Examiner' : undefined,
          ton: c.inscriptionsAExaminer ? 'ambre' : 'encre',
          onClick: synthese.droits.examinerInscriptions ? onInscriptions : undefined,
          testid: 'chiffre-inscriptions',
        },
        { valeur: c.actifsSansDoubleAuthentification, label: 'Actifs sans double authentification', ton: c.droitsElevesSansDoubleAuthentification ? 'rouge' : c.actifsSansDoubleAuthentification ? 'ambre' : 'vert', testid: 'chiffre-sans-2fa' },
        { valeur: c.jamaisConnectes, label: 'Jamais connectés', sous: 'Comptes actifs', ton: 'gris', testid: 'chiffre-jamais-connectes' },
      ]}
    />
  );
}

const GRILLE_AGENTS = 'lg:grid-cols-[110px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_110px_130px]';

/** Agents en activité du socle sans compte : « Ouvrir un compte » (administrateur) crée le compte rattaché à l'agent. */
function AgentsSansCompte({ synthese, onOuvrir }: { synthese: SyntheseComptes; onOuvrir: (agentId: string) => void }) {
  const l = synthese.agentsSansCompte;
  return (
    <section aria-labelledby="titre-agents-sans-compte">
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
