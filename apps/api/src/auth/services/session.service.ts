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
   * Jetons tout juste remplacés : empreinte de l'ancien jeton → session, pendant
   * DELAI_GRACE_ROTATION_MS. Deux renouvellements simultanés avec le même jeton (deux
   * onglets, deux chargements de page rapprochés) ne doivent pas déconnecter la personne :
   * le second reçoit un jeton d'accès, sans nouvelle rotation, et le navigateur garde le
   * cookie posé par le premier. En mémoire seulement (une seule instance de l'API) : un
   * redémarrage vide la liste, ce qui ne fait que rétablir la règle stricte.
   */
  private readonly recemmentRemplaces = new Map<string, { sessionId: string; expire: number }>();

  /**
   * Rotation du refresh token : même session (même id, donc même ligne dans
   * "Vos sessions actives"), mais nouvelle valeur de token à chaque
   * rafraîchissement — limite la fenêtre d'exploitation si un refresh token
   * fuite. L'ancien jeton n'est plus accepté qu'un court instant (voir
   * `recemmentRemplaces`), et jamais pour une session révoquée ou expirée.
   * `refreshToken` vaut null quand aucune rotation n'a eu lieu (jeton tout juste remplacé).
   */
  async rotateRefreshToken(plainRefreshToken: string): Promise<{ userId: string; refreshToken: string | null }> {
    const ancienHash = this.hashToken(plainRefreshToken);
    const session = await this.prisma.userSession.findFirst({ where: { refreshTokenHash: ancienHash, revokedAt: null } });
    if (session) {
      await this.verifierInactivite(session);
      const newPlainToken = this.generateToken();
      // Remplacement conditionnel : si une requête simultanée a déjà fait la rotation,
      // aucune ligne n'est modifiée et l'on passe par le délai de grâce ci-dessous.
      const { count } = await this.prisma.userSession.updateMany({
        where: { id: session.id, refreshTokenHash: ancienHash, revokedAt: null },
        data: { refreshTokenHash: this.hashToken(newPlainToken), lastUsedAt: new Date() },
      });
      if (count === 1) {
        this.noterRemplacement(ancienHash, session.id);
        return { userId: session.userId, refreshToken: newPlainToken };
      }
    }
    const remplace = this.recemmentRemplaces.get(ancienHash);
    if (remplace && remplace.expire > Date.now()) {
      const active = await this.prisma.userSession.findFirst({ where: { id: remplace.sessionId, revokedAt: null } });
      if (active) {
        await this.verifierInactivite(active);
        return { userId: active.userId, refreshToken: null };
      }
    }
    throw new UnauthorizedException('Session invalide ou révoquée');
  }

  async revokeSessionByToken(plainRefreshToken: string): Promise<void> {
    const hash = this.hashToken(plainRefreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Déconnexion avec un jeton tout juste remplacé (cookie d'un autre onglet) : la session
    // qu'il désignait est révoquée aussi.
    const remplace = this.recemmentRemplaces.get(hash);
    if (remplace && remplace.expire > Date.now()) {
      await this.prisma.userSession.updateMany({ where: { id: remplace.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
  }

  private noterRemplacement(ancienHash: string, sessionId: string): void {
    const maintenant = Date.now();
    if (this.recemmentRemplaces.size > 1000) {
      for (const [h, v] of this.recemmentRemplaces) if (v.expire <= maintenant) this.recemmentRemplaces.delete(h);
    }
    this.recemmentRemplaces.set(ancienHash, { sessionId, expire: maintenant + DELAI_GRACE_ROTATION_MS });
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

  /** Expiration après inactivité (paramètre, 30 jours par défaut — socle N2, §4.4). */
  private async verifierInactivite(session: { id: string; lastUsedAt: Date }): Promise<void> {
    const jours = await this.parametres.valeur('session.expirationJours');
    if (session.lastUsedAt.getTime() < Date.now() - jours * 864e5) {
      await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Session expirée après inactivité : reconnectez-vous.');
    }
  }
}

/** Délai pendant lequel un jeton tout juste remplacé reste accepté (sans nouvelle rotation). */
export const DELAI_GRACE_ROTATION_MS = 30_000;
