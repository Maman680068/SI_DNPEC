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
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: this.hashToken(plainToken), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) {
      throw new UnauthorizedException('Lien de réinitialisation invalide ou expiré');
    }
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return record.userId;
  }
}
