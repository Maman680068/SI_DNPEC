import { Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Rattachement {
  id: string;
  supervisorId?: string | null;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

/**
 * Chef(s) le(s) plus proche(s) d'un agent : supérieur désigné (assistant), puis chef de la cellule ou
 * de la section, puis chef de la division, enfin DN ou DNA. Le premier niveau pourvu d'un compte actif
 * (autre que l'agent) répond ; les niveaux au-dessus non. Sert à l'avis sur un congé (N3) et à l'alerte
 * de retard d'une tâche (N5).
 */
export async function chefsLesPlusProches(prisma: PrismaService | Prisma.TransactionClient, cible: Rattachement): Promise<string[]> {
  const niveaux: Prisma.UserWhereInput[] = [];
  if (cible.supervisorId) niveaux.push({ id: cible.supervisorId });
  if (cible.celluleId) niveaux.push({ role: SystemRole.CHEF_CELLULE, celluleId: cible.celluleId });
  if (cible.divisionId && cible.sectionId) niveaux.push({ role: SystemRole.CHEF_SECTION, divisionId: cible.divisionId, sectionId: cible.sectionId });
  if (cible.divisionId) niveaux.push({ role: SystemRole.CHEF_DIVISION, divisionId: cible.divisionId });
  niveaux.push({ role: { in: [SystemRole.DN, SystemRole.DNA] } });
  for (const niveau of niveaux) {
    const ids = (await prisma.user.findMany({ where: { AND: [niveau, { status: UserStatus.ACTIF, id: { not: cible.id } }] }, select: { id: true } })).map((u) => u.id);
    if (ids.length) return ids;
  }
  return [];
}
