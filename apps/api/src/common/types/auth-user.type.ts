import { RoleFonctionnel, SystemRole, UserStatus } from '@prisma/client';

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

  // Suppléance/intérim (§4.10) — renseigné par JwtAuthGuard uniquement quand
  // la requête porte l'en-tête X-Interim-For ET qu'une Suppleance active le
  // justifie (sinon 403, jamais un remplissage silencieux). Quand non-null,
  // role/divisionId/sectionId/celluleId ci-dessus sont ceux du TITULAIRE
  // (pas du suppléant) — autorité ET visibilité empruntées d'un coup, par
  // requête, jamais en permanence. `id` reste toujours celui du suppléant
  // réel : c'est lui qui doit apparaître comme auteur de l'action dans les
  // enregistrements métier (approverId, validatedById...) — seul le journal
  // d'audit porte la mention "par intérim" (AuditLog.onBehalfOfId, posé par
  // AuditService via RequestContext, jamais ici). CascadeService s'appuie
  // sur ce champ à deux endroits : hasHierarchicalAuthorityOver (empêche le
  // suppléant d'agir sur le titulaire lui-même en empruntant son propre
  // rôle) et isActingFor (contrôles par identité littérale, ex. organisateur
  // de réunion).
  interimForId: string | null;

  // Socle NIMBA (N1) — agent rattaché au compte (null : compte sans agent,
  // cas transitoire rattrapé par ReprisesN1Service) et rôles fonctionnels
  // ACTIFS de la personne réelle (axe 2, §5.2). Jamais empruntés en intérim :
  // un suppléant garde ses propres rôles, seuls la position et le périmètre
  // du titulaire s'empruntent (décision validée).
  agentId: string | null;
  rolesFonctionnels: RoleFonctionnel[];
}
