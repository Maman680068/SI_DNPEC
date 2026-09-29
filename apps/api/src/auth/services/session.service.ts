import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../../socle/parametres.service';

/**
 * Gère les UserSession (RF-SEC-05 : déconnexion à distance / partout).
 * Le refresh token n'est jamais stocké en clair : seul son SHA-256
 * (`refreshTokenHash`) est persisté, comparé au hash du token reçu du
 * client. SHA-256 (et non argon2/bcrypt) est suffisant ici — ce n'est pas
 * un secret à faible entropie choisi par un humain, mais 48 octets
 * aléatoires : la résistance vient de l'entropie de la valeur, pas d'un
 * hachage lent.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(48).toString('base64url');
  }

  async createSession(userId: string, deviceLabel?: string): Promise<string> {
    const plainRefreshToken = this.generateToken();
    await this.prisma.userSession.create({
      data: {
        userId,
        deviceLabel,
        refreshTokenHash: this.hashToken(plainRefreshToken),
      },
    });
    return plainRefreshToken;
  }

  /**
   * Rotation du refresh token : même session (même id, donc même ligne dans
   * "Vos sessions actives"), mais nouvelle valeur de token à chaque
   * rafraîchissement — limite la fenêtre d'exploitation si un refresh token
   * fuite (l'ancien devient immédiatement invalide).
   */
  async rotateRefreshToken(plainRefreshToken: string): Promise<{ userId: string; refreshToken: string }> {
    const session = await this.findActiveSessionByToken(plainRefreshToken);
    const newPlainToken = this.generateToken();

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hashToken(newPlainToken), lastUsedAt: new Date() },
    });

    return { userId: session.userId, refreshToken: newPlainToken };
  }

  async revokeSessionByToken(plainRefreshToken: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: this.hashToken(plainRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session introuvable');
    }
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  listActiveSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
    });
  }

  private async findActiveSessionByToken(plainRefreshToken: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { refreshTokenHash: this.hashToken(plainRefreshToken), revokedAt: null },
    });
    if (!session) throw new UnauthorizedException('Session invalide ou révoquée');
    // Expiration après inactivité (paramètre, 30 jours par défaut — socle N2, §4.4).
    const jours = await this.parametres.valeur('session.expirationJours');
    if (session.lastUsedAt.getTime() < Date.now() - jours * 864e5) {
      await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Session expirée après inactivité : reconnectez-vous.');
    }
    return session;
  }
}
