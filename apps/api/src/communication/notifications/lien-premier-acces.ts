import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/** Durée de validité du lien envoyé à la création d'un compte (premier contact). */
export const DUREE_LIEN_PREMIER_ACCES_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lien « choisir mon mot de passe » envoyé à la création d'un compte (import
 * du DRH, création par l'administrateur). Même mécanisme que « mot de passe
 * oublié » (PasswordResetToken, usage unique, page /reset-password), mais
 * valable 7 jours : c'est un premier contact, pas une demande active de la
 * personne. Fonction simple (pas un service du module auth/) : importer
 * AuthModule créerait un cycle avec UsersModule et PersonnelModule.
 */
export async function creerLienPremierAcces(prisma: PrismaService, webAppUrl: string, userId: string): Promise<string> {
  const jeton = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(jeton).digest('hex');
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + DUREE_LIEN_PREMIER_ACCES_MS) },
  });
  return `${webAppUrl}/reset-password?token=${jeton}`;
}
