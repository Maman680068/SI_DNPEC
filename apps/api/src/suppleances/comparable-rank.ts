import { SystemRole } from '@prisma/client';

type RankedUser = { role: SystemRole; divisionId: string | null };

/**
 * Règle du « rang comparable » (§3.1, suppléance §4.10) — qui peut suppléer qui :
 * - DN/DNA : DN, DNA, Chef de Division ou Chef de Cellule ;
 * - Chef de Division ou de Cellule : un autre Chef de Division ou de Cellule,
 *   ou un Chef de Section de SA propre division (jamais pour un Chef de
 *   Cellule, qui n'a pas de division) ;
 * - Chef de Section : un Chef de Section de la même division, ou son Chef de
 *   Division.
 * Tout autre rôle de titulaire : jamais (seuls les rôles « chef » ont une
 * autorité à emprunter).
 *
 * Fonction pure, appliquée sur les rôles ACTUELS à deux moments : à la
 * désignation (SuppleancesService.create) ET à chaque utilisation de
 * l'en-tête X-Interim-For (JwtAuthGuard) — une suppléance désignée avant
 * cette règle, ou devenue non conforme après un changement de rôle, est
 * ainsi bloquée à l'usage sans que la donnée existante soit modifiée.
 */
export function isComparableRank(titulaire: RankedUser, suppleant: RankedUser): boolean {
  switch (titulaire.role) {
    case SystemRole.DN:
    case SystemRole.DNA:
      return (
        suppleant.role === SystemRole.DN ||
        suppleant.role === SystemRole.DNA ||
        suppleant.role === SystemRole.CHEF_DIVISION ||
        suppleant.role === SystemRole.CHEF_CELLULE
      );
    case SystemRole.CHEF_DIVISION:
    case SystemRole.CHEF_CELLULE:
      return (
        suppleant.role === SystemRole.CHEF_DIVISION ||
        suppleant.role === SystemRole.CHEF_CELLULE ||
        (suppleant.role === SystemRole.CHEF_SECTION &&
          !!titulaire.divisionId &&
          suppleant.divisionId === titulaire.divisionId)
      );
    case SystemRole.CHEF_SECTION:
      return (
        (suppleant.role === SystemRole.CHEF_SECTION || suppleant.role === SystemRole.CHEF_DIVISION) &&
        !!titulaire.divisionId &&
        suppleant.divisionId === titulaire.divisionId
      );
    default:
      return false;
  }
}

export const COMPARABLE_RANK_DESIGNATION_MESSAGE =
  'Le suppléant doit être de rang comparable au titulaire : DN/DNA → DN, DNA, Chef de Division ou de Cellule ; ' +
  'Chef de Division ou de Cellule → un autre Chef de Division ou de Cellule, ou un Chef de Section de sa division ; ' +
  'Chef de Section → un Chef de Section de la même division ou son Chef de Division.';

export const COMPARABLE_RANK_USAGE_MESSAGE =
  'Cette suppléance ne respecte pas la règle de rang comparable ; elle doit être redésignée.';
