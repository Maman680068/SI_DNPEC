import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure

/**
 * Jetons de réinitialisation de mot de passe — même principe que
 * SessionService pour les refresh tokens : seul le SHA-256 du jeton est
 * stocké (jamais le jeton en clair), suffisant ici car la résistance vient
 * de l'entropie de la valeur aléatoire (32 octets), pas d'un hachage lent.
 */
@Injectable()
export class PasswordResetService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async createResetToken(userId: string): Promise<string> {
    const plainToken = this.generateToken();
    // Revue de sécurité 2026-10 : un nouveau lien remplace les précédents (un seul lien valable).
    await this.prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(plainToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    return plainToken;
  }

  /** Valide le jeton (non expiré, non déjà utilisé), le marque comme utilisé
   * (usage unique) et renvoie l'id de l'utilisateur concerné. */
  async consumeToken(plainToken: string): Promise<string> {
    const tokenHash = this.hashToken(plainToken);
    const maintenant = new Date();
    // Consommation atomique (revue de sécurité 2026-10) : deux requêtes simultanées ne peuvent pas
    // utiliser le même lien — une seule voit sa mise à jour aboutir.
    const { count } = await this.prisma.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: maintenant } },
      data: { usedAt: maintenant },
    });
    const record = count === 1 ? await this.prisma.passwordResetToken.findFirst({ where: { tokenHash }, select: { userId: true } }) : null;
    if (!record) {
      throw new UnauthorizedException('Lien de réinitialisation invalide ou expiré');
    }
    // Les autres liens encore valables du compte deviennent caducs.
    await this.prisma.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: maintenant } });
    return record.userId;
  }
}
