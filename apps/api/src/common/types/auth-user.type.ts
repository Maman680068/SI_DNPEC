import { SystemRole, UserStatus } from '@prisma/client';

/** Forme de `request.user`, peuplée par JwtAuthGuard après vérification du token. */
export interface AuthenticatedUser {
  id: string;
  role: SystemRole;
  status: UserStatus;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}
