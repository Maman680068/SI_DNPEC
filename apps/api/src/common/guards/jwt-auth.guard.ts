import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/auth-user.type';
import { AnyAuthTokenPayload } from '../types/jwt-payload.type';
import { requestContextStorage } from '../request-context/request-context';

const INTERIM_HEADER = 'x-interim-for';

/**
 * Guard global : vérifie l'access token JWT et peuple request.user.
 * Volontairement indépendant du module `auth` — il ne fait que *vérifier*
 * les tokens ; `auth` réutilise le même JwtService (configuré dans
 * CommonModule) pour les *émettre*.
 *
 * N'accepte que purpose === 'access' : les jetons intermédiaires (challenge
 * 2FA, configuration 2FA requise, émis par AuthService avec le même secret)
 * sont délibérément rejetés ici pour ne jamais servir de jeton d'accès.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Jeton d’accès manquant');
    }

    let payload: AnyAuthTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AnyAuthTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Jeton d’accès invalide ou expiré');
    }
    if (payload.purpose !== 'access') {
      throw new UnauthorizedException('Ce jeton ne peut pas être utilisé comme jeton d’accès');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        divisionId: true,
        sectionId: true,
        celluleId: true,
        supervisor: { select: { role: true, celluleId: true } },
      },
    });

    if (!user || user.status !== UserStatus.ACTIF) {
      throw new UnauthorizedException('Compte introuvable ou inactif');
    }

    const { supervisor, ...rest } = user;
    let authenticatedUser: AuthenticatedUser = {
      ...rest,
      supervisorRole: supervisor?.role ?? null,
      supervisorCelluleId: supervisor?.celluleId ?? null,
      interimForId: null,
    };

    authenticatedUser = await this.applyInterimIfRequested(request, authenticatedUser);

    // Contexte de requête (AsyncLocalStorage, posé par RequestContextMiddleware
    // avant ce Guard) : lu par AuditService.log() pour tamponner
    // AuditLog.onBehalfOfId sans qu'aucun site d'appel n'ait à le savoir.
    const store = requestContextStorage.getStore();
    if (store) store.onBehalfOfId = authenticatedUser.interimForId;

    (request as Request & { user: AuthenticatedUser }).user = authenticatedUser;
    return true;
  }

  /**
   * Suppléance/intérim (§2.6) : en-tête X-Interim-For explicite, jamais
   * ambiant. Absent -> aucun changement. Présent sans Suppleance active
   * correspondante -> 403 explicite (jamais un échec silencieux qui
   * laisserait croire à l'appelant qu'il agit en son nom propre). Valide ->
   * role/divisionId/sectionId/celluleId remplacés par ceux du TITULAIRE :
   * fait fonctionner hasHierarchicalAuthorityOver et toute la visibilité
   * cascade sans aucune duplication de logique — `id` reste celui du
   * suppléant réel (voir AuthenticatedUser.interimForId).
   */
  private async applyInterimIfRequested(
    request: Request,
    actor: AuthenticatedUser,
  ): Promise<AuthenticatedUser> {
    const titulaireId = request.headers[INTERIM_HEADER];
    if (!titulaireId || Array.isArray(titulaireId)) return actor;

    const suppleance = await this.prisma.suppleance.findFirst({
      where: {
        suppleantId: actor.id,
        titulaireId,
        revokedAt: null,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      select: {
        titulaire: { select: { id: true, role: true, divisionId: true, sectionId: true, celluleId: true } },
      },
    });
    if (!suppleance) {
      throw new ForbiddenException(
        "Aucune suppléance active ne vous autorise à agir au nom de cette personne.",
      );
    }

    return {
      ...actor,
      role: suppleance.titulaire.role,
      divisionId: suppleance.titulaire.divisionId,
      sectionId: suppleance.titulaire.sectionId,
      celluleId: suppleance.titulaire.celluleId,
      // Un titulaire de suppléance est toujours un rôle "chef" (jamais
      // ASSISTANT_DIRECTION, restriction validée à la création) — jamais de
      // superviseur à emprunter.
      supervisorRole: null,
      supervisorCelluleId: null,
      interimForId: suppleance.titulaire.id,
    };
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
