import { SetMetadata } from '@nestjs/common';
import { RoleFonctionnel, SystemRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restreint une route à une liste de rôles système (contrôle grossier).
 * Pour l'autorisation fine liée au rattachement Division/Section/Cellule,
 * voir CascadeService — un Guard n'a pas accès à la ressource ciblée avant
 * l'appel au service.
 */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);

export const ROLES_FONCTIONNELS_KEY = 'rolesFonctionnels';

/**
 * Restreint une route aux détenteurs ACTIFS d'un des rôles fonctionnels
 * (axe 2 du socle NIMBA), jugés sur l'identité réelle (jamais empruntés en
 * intérim). Combiné à @Roles : la route est ouverte si l'une des deux listes
 * est satisfaite.
 */
export const RolesFonctionnels = (...roles: RoleFonctionnel[]) => SetMetadata(ROLES_FONCTIONNELS_KEY, roles);
