import { SystemRole, UserStatus } from '@prisma/client';

/** Forme de `request.user`, peuplée par JwtAuthGuard après vérification du token. */
export interface AuthenticatedUser {
  id: string;
  role: SystemRole;
  status: UserStatus;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  // Renseignés uniquement pour ASSISTANT_DIRECTION avec un superviseur
  // (User.supervisorId) — permettent à CascadeService de faire hériter la
  // visibilité (pas l'autorité ni le niveau de confidentialité) du
  // superviseur sans requête supplémentaire. null pour tous les autres rôles.
  supervisorRole: SystemRole | null;
  supervisorCelluleId: string | null;
}
