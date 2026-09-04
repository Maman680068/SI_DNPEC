import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/auth-user.type';

type OrgTarget = {
  id: string;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
};

/** Rôles à visibilité totale sur la DNPEC (§2.3). */
const TOP_LEVEL_ROLES: SystemRole[] = [SystemRole.DN, SystemRole.DNA, SystemRole.ADMIN_SYSTEME];

/**
 * Logique de délégation en cascade (§2.3) : qui voit / peut agir sur qui,
 * en fonction du rattachement Division/Section/Cellule. Volontairement un
 * service injectable et non un Guard — les décisions dépendent de données
 * de la ressource ciblée (son divisionId/sectionId/celluleId), qu'un Guard
 * ne peut pas charger avant l'appel au service.
 */
@Injectable()
export class CascadeService {
  /** Filtre Prisma à appliquer à User.findMany pour scoper une liste au périmètre de `actor`. */
  getVisibleUserWhere(actor: AuthenticatedUser): Prisma.UserWhereInput {
    if (TOP_LEVEL_ROLES.includes(actor.role)) {
      return {};
    }

    switch (actor.role) {
      case SystemRole.CHEF_DIVISION:
        return { divisionId: actor.divisionId ?? '__none__' };
      case SystemRole.CHEF_SECTION:
        return {
          divisionId: actor.divisionId ?? '__none__',
          sectionId: actor.sectionId ?? '__none__',
        };
      case SystemRole.CHEF_CELLULE:
        return { celluleId: actor.celluleId ?? '__none__' };
      default:
        // AGENT, ASSISTANT_DIRECTION : uniquement soi-même.
        return { id: actor.id };
    }
  }

  /** `actor` a-t-il autorité hiérarchique sur `target` (hors cas "soi-même") ? */
  canManageUser(actor: AuthenticatedUser, target: OrgTarget): boolean {
    if (TOP_LEVEL_ROLES.includes(actor.role)) return true;
    if (actor.id === target.id) return true;

    switch (actor.role) {
      case SystemRole.CHEF_DIVISION:
        return !!actor.divisionId && actor.divisionId === target.divisionId;
      case SystemRole.CHEF_SECTION:
        return (
          !!actor.divisionId &&
          actor.divisionId === target.divisionId &&
          !!actor.sectionId &&
          actor.sectionId === target.sectionId
        );
      case SystemRole.CHEF_CELLULE:
        return !!actor.celluleId && actor.celluleId === target.celluleId;
      default:
        return false;
    }
  }

  assertCanManageUser(actor: AuthenticatedUser, target: OrgTarget): void {
    if (!this.canManageUser(actor, target)) {
      throw new ForbiddenException(
        "Vous n'avez pas l'autorité hiérarchique nécessaire sur cet utilisateur.",
      );
    }
  }
}
