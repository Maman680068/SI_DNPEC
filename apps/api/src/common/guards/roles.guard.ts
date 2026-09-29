import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleFonctionnel, SystemRole } from '@prisma/client';
import { Request } from 'express';
import { ROLES_FONCTIONNELS_KEY, ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../types/auth-user.type';

/** Contrôle grossier par rôle. S'exécute après JwtAuthGuard (request.user déjà peuplé). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredFonctionnels = this.reflector.getAllAndOverride<RoleFonctionnel[]>(ROLES_FONCTIONNELS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const aucun = (l?: unknown[]) => !l || l.length === 0;
    if (aucun(requiredRoles) && aucun(requiredFonctionnels)) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return false;
    return (
      (!!requiredRoles && requiredRoles.includes(user.role)) ||
      (!!requiredFonctionnels && requiredFonctionnels.some((r) => user.rolesFonctionnels.includes(r)))
    );
  }
}
