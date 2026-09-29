import { ForbiddenException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { estDrh } from '../socle/roles-fonctionnels';

/**
 * Réglages des stages (capacités d'accueil, modèle d'attestation) : le DRH,
 * et l'administrateur système — qui doit pouvoir les tenir tant qu'aucun DRH
 * n'est nommé. L'administrateur n'accède jamais au CONTENU des stages (plan,
 * stagiaires, évaluations) : ces routes-là restent réservées au DRH.
 */
export function peutReglerStages(actor: Pick<AuthenticatedUser, 'role' | 'rolesFonctionnels'>): boolean {
  return estDrh(actor) || actor.role === SystemRole.ADMIN_SYSTEME;
}

export function assertReglagesStages(actor: Pick<AuthenticatedUser, 'role' | 'rolesFonctionnels'>): void {
  if (!peutReglerStages(actor)) throw new ForbiddenException('Réservé au DRH et à l’administrateur système.');
}

/**
 * Modèle d'attestation livré avec l'application (paramétrage initial) : sa clé
 * de fichier « integre:<nom> » désigne un fichier de apps/api/assets, présent
 * dans le dépôt et donc dans chaque déploiement — le script de paramétrage,
 * exécuté hors du serveur, ne peut pas écrire dans le stockage de l'API.
 * Un modèle importé à l'écran le remplace (stockage habituel).
 */
export { PREFIXE_INTEGRE, cheminIntegre } from '../common/storage/fichiers-integres';
export const MODELE_ATTESTATION_INTEGRE = 'modele-attestation-dnpec.docx';
