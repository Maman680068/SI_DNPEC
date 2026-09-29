import { Prisma, PrismaClient, RoleFonctionnel, UserStatus } from '@prisma/client';

/**
 * Habilitation à deux axes (cahier NIMBA, Partie 0 §5) — axe 2 : les rôles
 * fonctionnels, attribués explicitement, datés et cumulables. Ce fichier ne
 * dépend d'aucun service Nest : il est aussi utilisé par JwtAuthGuard et par
 * les scripts (démonstration, reprise).
 */

/** Libellés affichés (écrans, emails). */
export const LIBELLE_ROLE_FONCTIONNEL: Record<RoleFonctionnel, string> = {
  DRH: 'Directeur des Ressources Humaines',
  GESTIONNAIRE_RH: 'Gestionnaire RH',
  CHEF_SAF: 'Chef du SAF',
  GESTIONNAIRE_PAIE: 'Gestionnaire paie',
  ENCADREUR_STAGE: 'Encadreur de stage',
  AGENT_COURRIER: 'Agent du courrier',
  ASSISTANT: 'Assistant(e) de direction',
  VALIDATEUR: 'Validateur',
  GESTIONNAIRE_LOGISTIQUE: 'Gestionnaire logistique',
  RESPONSABLE_MODELE: 'Responsable de modèle',
  ANALYSTE: 'Analyste',
  DECIDEUR: 'Décideur',
};

/** Rôles du domaine B : prévus en base, sans écran dans ce programme. */
export const ROLES_SANS_ECRAN: RoleFonctionnel[] = [
  RoleFonctionnel.RESPONSABLE_MODELE,
  RoleFonctionnel.ANALYSTE,
  RoleFonctionnel.DECIDEUR,
];

/**
 * Rôles gérés depuis l'écran de leur module (granularité propre) : le courrier
 * par registre et par unité, la logistique par personne. Leur attribution est
 * le reflet exact de la table d'habilitation historique, écrite dans la même
 * transaction — jamais attribués ni retirés depuis l'écran générique.
 */
export const ROLES_GERES_PAR_MODULE: RoleFonctionnel[] = [
  RoleFonctionnel.AGENT_COURRIER,
  RoleFonctionnel.GESTIONNAIRE_LOGISTIQUE,
];

/** Filtre d'une attribution ACTIVE à l'instant `maintenant`. */
export function attributionActiveWhere(maintenant = new Date()): Prisma.AttributionRoleWhereInput {
  return {
    retireLe: null,
    dateDebut: { lte: maintenant },
    OR: [{ dateFin: null }, { dateFin: { gt: maintenant } }],
  };
}

/** Comptes actifs détenant `role` (destinataires de notifications, contrôles). */
export function detenteursWhere(role: RoleFonctionnel, maintenant = new Date()): Prisma.UserWhereInput {
  return { status: UserStatus.ACTIF, attributionsRoles: { some: { role, ...attributionActiveWhere(maintenant) } } };
}

/** Rôles actifs d'un compte (sans doublon). */
export async function rolesActifs(
  prisma: Pick<PrismaClient, 'attributionRole'> | Prisma.TransactionClient,
  userId: string,
  maintenant = new Date(),
): Promise<RoleFonctionnel[]> {
  const rows = await prisma.attributionRole.findMany({
    where: { userId, ...attributionActiveWhere(maintenant) },
    select: { role: true },
    distinct: ['role'],
  });
  return rows.map((r) => r.role);
}

/** L'acteur (identité réelle, jamais empruntée) détient-il `role` ? */
export function aRole(actor: { rolesFonctionnels?: RoleFonctionnel[] }, role: RoleFonctionnel): boolean {
  return !!actor.rolesFonctionnels?.includes(role);
}

/** DRH : décision sur les agents, dossiers, stages (remplace le test `role === DRH`). */
export function estDrh(actor: { rolesFonctionnels?: RoleFonctionnel[] }): boolean {
  return aRole(actor, RoleFonctionnel.DRH);
}
