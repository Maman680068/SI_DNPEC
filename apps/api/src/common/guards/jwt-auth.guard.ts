import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/auth-user.type';
import { AnyAuthTokenPayload } from '../types/jwt-payload.type';

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
    const authenticatedUser: AuthenticatedUser = {
      ...rest,
      supervisorRole: supervisor?.role ?? null,
      supervisorCelluleId: supervisor?.celluleId ?? null,
    };

    (request as Request & { user: AuthenticatedUser }).user = authenticatedUser;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
