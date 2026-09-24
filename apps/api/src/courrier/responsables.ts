import { Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseUniteKey } from './unites';

/**
 * Responsables d'une unité de registre, pour les notifications (jamais pour
 * une autorisation) : DNPEC → DN et DNA ; Division/Cellule → son chef actif,
 * ou DN et DNA si l'unité n'en a pas (CTSCM, CNC). Utilisé pour « courrier à
 * imputer » et « acte à signer ».
 */
export async function responsablesDeUnite(prisma: PrismaService, uniteKey: string): Promise<string[]> {
  const ref = parseUniteKey(uniteKey);
  const direction: Prisma.UserWhereInput = { role: { in: [SystemRole.DN, SystemRole.DNA] }, status: UserStatus.ACTIF };
  const where: Prisma.UserWhereInput =
    ref.kind === 'DIVISION'
      ? { role: SystemRole.CHEF_DIVISION, divisionId: ref.divisionId, status: UserStatus.ACTIF }
      : ref.kind === 'CELLULE'
        ? { role: SystemRole.CHEF_CELLULE, celluleId: ref.celluleId, status: UserStatus.ACTIF }
        : direction;
  let ids = (await prisma.user.findMany({ where, select: { id: true } })).map((u) => u.id);
  if (ids.length === 0 && ref.kind !== 'DIRECTION') {
    ids = (await prisma.user.findMany({ where: direction, select: { id: true } })).map((u) => u.id);
  }
  return ids;
}
