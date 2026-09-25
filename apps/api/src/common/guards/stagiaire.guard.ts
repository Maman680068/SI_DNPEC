import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OUVERT_AUX_STAGIAIRES_KEY } from '../decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../types/auth-user.type';

/**
 * Rôle STAGIAIRE (D6) : liste blanche. Toute route est refusée (403) à un
 * stagiaire sauf si elle, ou son contrôleur, porte @OuvertAuxStagiaires() —
 * un nouveau module reste ainsi fermé aux stagiaires tant qu'on ne l'a pas
 * ouvert explicitement. S'exécute après JwtAuthGuard et RolesGuard.
 */
@Injectable()
export class StagiaireGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (request.user?.role !== SystemRole.STAGIAIRE) return true;
    if (this.reflector.getAllAndOverride<boolean>(OUVERT_AUX_STAGIAIRES_KEY, targets)) return true;
    throw new ForbiddenException('Cette fonctionnalité n’est pas accessible aux stagiaires.');
  }
}
