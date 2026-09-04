import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/auth-user.type';

interface AccessTokenPayload {
  sub: string;
}

/**
 * Guard global : vérifie l'access token JWT et peuple request.user.
 * Volontairement indépendant du module `auth` (pas encore construit) —
 * il ne fait que *vérifier* les tokens ; `auth` réutilisera le même
 * JwtService (configuré dans CommonModule) pour les *émettre*.
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

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Jeton d’accès invalide ou expiré');
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
      },
    });

    if (!user || user.status !== UserStatus.ACTIF) {
      throw new UnauthorizedException('Compte introuvable ou inactif');
    }

    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
