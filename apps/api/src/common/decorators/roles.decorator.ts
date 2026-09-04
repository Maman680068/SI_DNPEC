import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restreint une route à une liste de rôles système (contrôle grossier).
 * Pour l'autorisation fine liée au rattachement Division/Section/Cellule,
 * voir CascadeService — un Guard n'a pas accès à la ressource ciblée avant
 * l'appel au service.
 */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
