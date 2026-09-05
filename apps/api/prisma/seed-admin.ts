import { PrismaClient, SystemRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Même règle que RegisterDto (apps/api/src/auth/dto/register.dto.ts) — un
// compte créé hors du flux d'inscription normal doit respecter la même
// politique de mot de passe, pas moins.
const MIN_PASSWORD_LENGTH = 12;
const PROFESSIONAL_EMAIL_DOMAIN = /@dnpec\.gov\.gn$/;

/**
 * Amorce le tout premier compte de la base (aucun utilisateur n'existe
 * encore) en ADMIN_SYSTEME — rôle de gestion des comptes/de l'organisation,
 * volontairement sans autorité sur le contenu métier (§3.1, voir
 * cascade.service.ts) et sans 2FA obligatoire (auth.service.ts,
 * MANDATORY_2FA_ROLES). Le vrai DN/DNA et les autres dirigeants sont ensuite
 * créés via le flux d'inscription + approbation normal, avec ce compte.
 *
 * Idempotent : si un compte existe déjà pour cet email, ne fait rien (rejeu
 * sans erreur possible).
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Admin';
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'Système';

  if (!email) {
    throw new Error('ADMIN_EMAIL manquant (secret GitHub non fourni ou vide).');
  }
  if (!PROFESSIONAL_EMAIL_DOMAIN.test(email)) {
    throw new Error(`ADMIN_EMAIL doit être une adresse @dnpec.gov.gn (reçu : "${email}").`);
  }
  if (!password) {
    throw new Error('ADMIN_PASSWORD manquant (secret GitHub non fourni ou vide).');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD trop court (${password.length} caractères, minimum ${MIN_PASSWORD_LENGTH}).`,
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(
      `Un compte existe déjà pour ${email} (id=${existing.id}, role=${existing.role}) — aucune action (script idempotent).`,
    );
    return;
  }

  const csid = await prisma.cellule.findUnique({ where: { code: 'CSID' } });
  if (!csid) {
    throw new Error(
      "Cellule CSID introuvable — exécutez d'abord le workflow de migration (db-migrate.yml), qui peuple les 5 cellules, avant de créer ce compte.",
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: SystemRole.ADMIN_SYSTEME,
      status: UserStatus.ACTIF,
      celluleId: csid.id,
    },
  });

  console.log(
    `Compte administrateur créé : ${user.email} (id=${user.id}, role=ADMIN_SYSTEME, cellule=CSID).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
