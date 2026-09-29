import type { SystemRole } from '../auth/types';

export type UserStatus = 'EN_ATTENTE' | 'ACTIF' | 'SUSPENDU' | 'SUPPRIME';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  photoUrl: string | null;
  jobTitle: string | null;
  role: SystemRole;
  status: UserStatus;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  /** Personne assistée (ASSISTANT_DIRECTION uniquement) — voir schema.prisma, User.supervisorId. */
  supervisorId: string | null;
  /** Rattachement souhaité, déclaré par la personne elle-même à l'inscription
   * — purement informatif, jamais une affectation réelle (voir schema.prisma). */
  declaredDivisionId: string | null;
  declaredSectionId: string | null;
  declaredCelluleId: string | null;
  declaredSupervisorId: string | null;
  /** Poste actuel déclaré à l'inscription (ex. "CHEF_DIVISION") — voir
   * schema.prisma, User.declaredRole. Purement informatif. */
  declaredRole: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgAttachment {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  supervisorId: string | null;
}

export interface CreateUserInput extends OrgAttachment {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  /** Socle NIMBA : agent existant (sans compte) ou matricule du nouvel agent. */
  agentId?: string;
  matricule?: string;
}

export interface ApproveUserInput extends OrgAttachment {
  role: SystemRole;
  agentId?: string;
  matricule?: string;
}

export const SYSTEM_ROLES: SystemRole[] = [
  'DN',
  'DNA',
  'CHEF_DIVISION',
  'CHEF_SECTION',
  'CHEF_CELLULE',
  'AGENT',
  'ADMIN_SYSTEME',
  'ASSISTANT_DIRECTION',
  // Attribuable par l'administrateur à la création et à l'approbation — jamais
  // déclarable à l'auto-inscription (absent de DECLARABLE_ROLES, lib/auth/types).
  'DRH',
  // Stagiaire (D6) : rattachement facultatif, tenu par la rotation du stage.
  'STAGIAIRE',
];

export const ROLE_LABEL: Record<SystemRole, string> = {
  DN: 'Directeur National',
  DNA: 'Directeur National Adjoint',
  CHEF_DIVISION: 'Chef de Division',
  CHEF_SECTION: 'Chef de Section',
  CHEF_CELLULE: 'Chef de Cellule',
  AGENT: 'Agent / Chargé d’Études',
  ADMIN_SYSTEME: 'Administrateur Système',
  ASSISTANT_DIRECTION: 'Assistant(e) de Direction',
  DRH: 'Directeur des Ressources Humaines',
  STAGIAIRE: 'Stagiaire',
};

/**
 * Rôles proposables à la création/approbation. CHEF_CELLULE en est exclu :
 * POST /users et POST /users/:id/approve posent role+celluleId sur
 * l'utilisateur mais ne touchent jamais Cellule.chefId, contrairement à
 * POST /org/cellules/:id/chef (CellulesService.assignChef) qui est
 * transactionnel — démet l'ancien chef, promeut le nouveau ET pose
 * Cellule.chefId, en maintenant l'invariant documenté dans schema.prisma.
 * Nommer un chef de cellule se fait sur un compte déjà existant, via
 * l'action "Nommer chef de cellule" de la table (AssignChefModal).
 */
export const ASSIGNABLE_ROLES: SystemRole[] = SYSTEM_ROLES.filter((r) => r !== 'CHEF_CELLULE');

export const STATUS_LABEL: Record<UserStatus, string> = {
  EN_ATTENTE: 'En attente',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  // Suppression logique (voir schema.prisma, UserStatus.SUPPRIME) : le
  // compte et tout ce qui lui est lié restent intacts, seule la connexion
  // est bloquée.
  SUPPRIME: 'Désactivé',
};

/** Rôles pour lesquels la page Utilisateurs apparaît dans le menu — ADMIN_SYSTEME en
 * gestion complète, DN/DNA en lecture seule (voir page.tsx : le backend réserve
 * GET /users/pending, POST /users, /approve, /reject et /status à ADMIN_SYSTEME). */
export const USERS_PAGE_VISIBLE_ROLES = ['ADMIN_SYSTEME', 'DN', 'DNA'];

/** Changement de rôle (POST /users/:id/role et /role/apercu). */
export interface ChangementRoleInput {
  role: SystemRole;
  roleAttendu: SystemRole;
  divisionId?: string | null;
  sectionId?: string | null;
  celluleId?: string | null;
  supervisorId?: string | null;
  jobTitle?: string;
  motif: string;
}

interface RattachementRole {
  role: SystemRole;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  supervisorId: string | null;
  jobTitle: string | null;
}

/** Aperçu (= effets appliqués) d'un changement de rôle, calculé par l'API. */
export interface ChangementRoleApercu {
  userId: string;
  avant: RattachementRole;
  apres: RattachementRole;
  applique?: boolean;
  effets: {
    suppleancesRevoquees: { id: string; titulaire: string; suppleant: string; debut: string; fin: string }[];
    suppleancesConservees: { id: string; titulaire: string; suppleant: string }[];
    accesDeleguesRevoques: number;
    habilitationsConservees: { id: string; registre: string; uniteKey: string }[];
    imputationsEnCours: { id: string; courrierId: string; numero: string }[];
    circuitsDeVisaARecalculer: { acteId: string; objet: string }[];
    taches: { assignees: number; creees: number };
    celluleQuittee: string | null;
    celluleNommee: string | null;
    sessionsRevoquees: number;
  };
}
