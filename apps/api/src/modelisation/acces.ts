import { RoleModelisation, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';

/**
 * Rôles de modélisation d'une personne (domaine B) : le rang ne donne aucun droit. Personnels,
 * jugés sur l'identité réelle (`actor.id`) et jamais empruntés en intérim, comme les habilitations.
 * L'administrateur des modèles est la position ADMIN_SYSTEME (hors intérim).
 */
export type RolesModelisation = {
  administrateur: boolean;
  analyste: boolean;
  responsableDe: string[];
  suppleantDe: string[];
};

export async function rolesModelisation(prisma: PrismaService, actor: Pick<AuthenticatedUser, 'id' | 'role' | 'interimForId'>): Promise<RolesModelisation> {
  const ouvertes = await prisma.affectationModelisation.findMany({ where: { userId: actor.id, fin: null }, select: { role: true, modeleId: true } });
  return {
    // En intérim, `role` est celui du titulaire : l'administration des modèles ne s'emprunte pas.
    administrateur: actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId,
    analyste: ouvertes.some((a) => a.role === RoleModelisation.ANALYSTE),
    responsableDe: ouvertes.filter((a) => a.role === RoleModelisation.RESPONSABLE).map((a) => a.modeleId!),
    suppleantDe: ouvertes.filter((a) => a.role === RoleModelisation.SUPPLEANT).map((a) => a.modeleId!),
  };
}

/** Accès au menu Modélisation : un rôle de modélisation, ou l'administrateur. */
export const aAccesModelisation = (r: RolesModelisation) => r.administrateur || r.analyste || r.responsableDe.length > 0 || r.suppleantDe.length > 0;

/** Responsable ou suppléant de ce modèle. */
export const gouverne = (r: RolesModelisation, modeleId: string) => r.responsableDe.includes(modeleId) || r.suppleantDe.includes(modeleId);

/** Désignation d'un responsable ou d'un suppléant : administrateur, DN ou DNA (poste propre, hors intérim). */
export const peutDesigner = (actor: Pick<AuthenticatedUser, 'role' | 'interimForId'>) =>
  !actor.interimForId && ([SystemRole.ADMIN_SYSTEME, SystemRole.DN, SystemRole.DNA] as SystemRole[]).includes(actor.role);
